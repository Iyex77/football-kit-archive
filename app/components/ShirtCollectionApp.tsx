"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase-auth";
import {
  catalog,
  defaultForm,
  emptyFilters,
  placeholderImages,
  sportLabels,
  statusLabels,
} from "../lib/collection-data";
import type {
  Shirt,
  ShirtCategory,
  ShirtFilters,
  ShirtFormState,
  ShirtStatus,
  Profile,
  Sport,
  TeamOption,
} from "../lib/types";
import { notify } from "../lib/notify";
import { AppDrawer } from "./AppDrawer";
import { FiltersBar } from "./FiltersBar";
import { ImageGalleryModal } from "./ImageGalleryModal";
import { ShirtCard } from "./ShirtCard";
import { ShirtForm } from "./ShirtForm";

type SortField = "added" | "team" | "player" | "number" | "season";
type SortDirection = "asc" | "desc";
type CollectionViewStyle = "grid" | "compact";
type PublicShowcaseTab = "featured" | "collection" | "wishlist" | "all";
type FeaturedQuickFilter = "all" | "collection" | "wishlist";

type SortBy = {
  field: SortField;
  direction: SortDirection;
};

type StatsDetailKey =
  | "all"
  | "collection"
  | "wishlist"
  | "countries"
  | "teams"
  | "leagues"
  | "seasons"
  | "players"
  | "numbers"
  | "kitTypes"
  | "sizes";

type StatsRankingEntry = {
  key: string;
  name: string;
  total: number;
  collection: number;
  wishlist: number;
  count: number;
};

type SelectedStatsItem = {
  key: StatsDetailKey;
  entry: StatsRankingEntry;
};

const unique = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

const getSportFilterFromSearch = (search: string): "all" | Sport => {
  const sport = new URLSearchParams(search).get("sport");
  return sport === "football" || sport === "basketball" ? sport : "all";
};

const defaultSortDirectionByField: Record<SortField, SortDirection> = {
  added: "desc",
  team: "asc",
  player: "asc",
  number: "asc",
  season: "desc",
};

const sortOptions: Array<{ field: SortField; label: string; ascLabel: string; descLabel: string }> = [
  { field: "added", label: "Añadidas", ascLabel: "Antiguas primero", descLabel: "Recientes primero" },
  { field: "team", label: "Equipo", ascLabel: "A-Z", descLabel: "Z-A" },
  { field: "player", label: "Jugador", ascLabel: "A-Z", descLabel: "Z-A" },
  { field: "number", label: "Dorsal", ascLabel: "0-99", descLabel: "99-0" },
  { field: "season", label: "Temporada", ascLabel: "Antigua primero", descLabel: "Reciente primero" },
];

const viewPreferenceKey = "football-kit-archive-view-style";
const publicBioFallback =
  "Una vitrina personal de camisetas, recuerdos y futuras piezas seleccionadas con criterio de coleccionista.";
const featuredLimit = 9;
const featuredSuggestionLimit = 12;
const featuredSearchLimit = 20;

const compactLabel = (value: string) => value.trim().replace(/\s+/g, " ");

const normalizeStatsKey = (value: string) =>
  compactLabel(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const getLeagueStatsValue = (value: string) => {
  const label = compactLabel(value);
  const key = normalizeStatsKey(label);
  if (!key) return "";
  if (key === "laligaeasports") return "LaLiga EA Sports";
  if (key === "laligahypermotion") return "LaLiga Hypermotion";
  return label;
};

const getPlayerStatsValue = (value: string) => {
  const label = compactLabel(value);
  const key = normalizeStatsKey(label);
  if (!key || key === "sinnombre" || key === "sinjugador") return "";
  return label;
};

const getKitTypeStatsValue = (value: string) => {
  const key = normalizeStatsKey(value);
  if (!key) return "";
  if (["local", "home", "primera", "primeraequipacion", "1", "1st"].includes(key)) return "Local";
  if (["visitante", "away", "segunda", "segundaequipacion", "2", "2nd"].includes(key)) return "Visitante";
  if (["tercera", "third", "terceraequipacion", "3", "3rd"].includes(key)) return "Tercera";
  if (["cuarta", "fourth", "cuartaequipacion", "4", "4th"].includes(key)) return "Cuarta";
  if (["portero", "goalkeeper", "gk", "keeper"].includes(key)) return "Portero";
  if (
    ["especial", "special", "edicionespecial", "edition", "fourth", "cuarta", "alternativa", "cup"].includes(key)
  ) {
    return "Especial";
  }
  return compactLabel(value);
};

const getSizeStatsValue = (value: string) => {
  const key = normalizeStatsKey(value).replace(/^size/, "");
  const sizeMap: Record<string, string> = {
    extrasmall: "XS",
    xs: "XS",
    small: "S",
    s: "S",
    medium: "M",
    m: "M",
    large: "L",
    l: "L",
    extralarge: "XL",
    xl: "XL",
    xxl: "XXL",
    "2xl": "XXL",
    xxxl: "3XL",
    "3xl": "3XL",
    xxxxl: "4XL",
    "4xl": "4XL",
    xxxxxl: "5XL",
    "5xl": "5XL",
  };
  return sizeMap[key] ?? "";
};

const getStatsValue = (shirt: Shirt, key: StatsDetailKey) => {
  switch (key) {
    case "teams":
      return compactLabel(shirt.team);
    case "leagues":
      return getLeagueStatsValue(shirt.league);
    case "seasons":
      return compactLabel(shirt.season);
    case "players":
      return getPlayerStatsValue(shirt.player);
    case "numbers":
      return compactLabel(shirt.number);
    case "countries":
      return compactLabel(shirt.country);
    case "kitTypes":
      return getKitTypeStatsValue(shirt.kitType);
    case "sizes":
      return getSizeStatsValue(shirt.size);
    default:
      return "";
  }
};

const countBy = (shirts: Shirt[], key: StatsDetailKey) =>
  Object.values(
    shirts.reduce<Record<string, StatsRankingEntry>>((counts, shirt) => {
      const value = getStatsValue(shirt, key);
      if (!value) return counts;
      const statsKey = normalizeStatsKey(value);
      if (!statsKey) return counts;
      counts[statsKey] ??= {
        key: statsKey,
        name: value,
        total: 0,
        collection: 0,
        wishlist: 0,
        count: 0,
      };
      counts[statsKey].total += 1;
      counts[statsKey].count = counts[statsKey].total;
      if (shirt.status === "wishlist") {
        counts[statsKey].wishlist += 1;
      } else {
        counts[statsKey].collection += 1;
      }
      return counts;
    }, {}),
  )
    .sort((entryA, entryB) => {
      if (entryA.total !== entryB.total) return entryB.total - entryA.total;
      return entryA.name.localeCompare(entryB.name, undefined, { sensitivity: "base" });
    });

const optionKey = (option: TeamOption) =>
  [option.sport, option.category, option.country, option.league, option.team]
    .map((value) => value.trim().toLowerCase())
    .join("|");

function createTeamOptions() {
  const options: TeamOption[] = [];

  (Object.keys(catalog) as Sport[]).forEach((sport) => {
    (Object.keys(catalog[sport]) as ShirtCategory[]).forEach((category) => {
      Object.entries(catalog[sport][category]).forEach(([country, leagues]) => {
        Object.entries(leagues).forEach(([league, teams]) => {
          teams.forEach((team) => {
            options.push({
              id: `${sport}-${category}-${country}-${league}-${team}`,
              team,
              sport,
              category,
              country,
              league,
            });
          });
        });
      });
    });
  });

  return options;
}

const allTeamOptions = createTeamOptions();

function createTeamOptionsFromShirts(shirts: Shirt[]) {
  return shirts
    .filter((shirt) => shirt.team.trim() !== "")
    .map((shirt) => ({
      id: `saved-${shirt.id}`,
      team: shirt.team.trim(),
      sport: shirt.sport,
      category: shirt.category,
      country: shirt.country.trim(),
      league: shirt.league.trim(),
    }));
}

function mergeTeamOptions(options: TeamOption[]) {
  const seen = new Set<string>();
  return options.filter((option) => {
    const key = optionKey(option);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function getTypeOptions(sport: string) {
  if (!sport || !(sport in catalog)) {
    return [] as ShirtCategory[];
  }

  return Object.keys(catalog[sport as Sport]) as ShirtCategory[];
}

function getCountryOptions(sport: string, category: string) {
  if (!sport || !category || !(sport in catalog)) {
    return [];
  }

  const sportCatalog = catalog[sport as Sport];
  return category in sportCatalog ? Object.keys(sportCatalog[category as ShirtCategory]) : [];
}

function getLeagueOptions(sport: string, category: string, country: string) {
  if (!sport || !category || !country || !(sport in catalog)) {
    return [];
  }

  const sportCatalog = catalog[sport as Sport];
  const categoryCatalog = category in sportCatalog ? sportCatalog[category as ShirtCategory] : undefined;
  return country && categoryCatalog && country in categoryCatalog ? Object.keys(categoryCatalog[country]) : [];
}

function getTeamOptions(sport: string, category: string, country: string, league: string) {
  if (!sport || !category || !country || !league || !(sport in catalog)) {
    return [];
  }

  const sportCatalog = catalog[sport as Sport];
  const categoryCatalog = category in sportCatalog ? sportCatalog[category as ShirtCategory] : undefined;
  const countryCatalog = country && categoryCatalog && country in categoryCatalog ? categoryCatalog[country] : undefined;
  return league && countryCatalog && league in countryCatalog ? countryCatalog[league] : [];
}

function formFromShirt(shirt: Shirt): ShirtFormState {
  const teams = getTeamOptions(shirt.sport, shirt.category, shirt.country, shirt.league);
  const team = teams.includes(shirt.team) ? shirt.team : "custom";

  return {
    ...shirt,
    team,
    customTeam: team === "custom" ? shirt.team : "",
  };
}

function getFilterOptions(shirts: Shirt[], filters: ShirtFilters) {
  const byStatus = shirts.filter((shirt) => filters.status === "all" || shirt.status === filters.status);
  const bySport = byStatus.filter((shirt) => filters.sport === "all" || shirt.sport === filters.sport);
  const byCategory = bySport.filter(
    (shirt) => filters.category === "all" || shirt.category === filters.category,
  );
  const countrySource =
    filters.category === "all"
      ? bySport.filter((shirt) => shirt.category === "club")
      : byCategory;
  const byCountry = byCategory.filter(
    (shirt) => filters.country === "all" || shirt.country === filters.country,
  );
  const leagueSource =
    filters.category === "all"
      ? byCountry.filter((shirt) => shirt.category === "club")
      : byCountry;
  const byLeague = byCountry.filter(
    (shirt) => filters.league === "all" || shirt.league === filters.league,
  );

  return {
    countries: unique(countrySource.map((shirt) => shirt.country)),
    leagues: unique(leagueSource.map((shirt) => shirt.league)),
    teams: unique(byLeague.map((shirt) => shirt.team)),
  };
}

function matchesFilters(shirt: Shirt, filters: ShirtFilters) {
  const haystack = [
    shirt.team,
    shirt.player,
    shirt.number,
    shirt.season,
    shirt.country,
    shirt.league,
    shirt.kitType,
    shirt.notes,
  ]
    .join(" ")
    .toLowerCase();

  return (
    haystack.includes(filters.search.trim().toLowerCase()) &&
    (filters.sport === "all" || shirt.sport === filters.sport) &&
    (filters.category === "all" || shirt.category === filters.category) &&
    (filters.status === "all" || shirt.status === filters.status) &&
    (filters.country === "all" || shirt.country === filters.country) &&
    (filters.league === "all" || shirt.league === filters.league) &&
    (filters.team === "all" || shirt.team === filters.team) &&
    (filters.year.trim() === "" || shirt.season.toLowerCase().includes(filters.year.trim().toLowerCase()))
  );
}

interface ShirtCollectionAppProps {
  onLogout?: () => Promise<void> | void;
  initialShirts?: Shirt[];
  publicProfile?: Profile;
  readOnly?: boolean;
  defaultViewMode?: "all" | "collection" | "wishlist" | "stats";
}

export function ShirtCollectionApp({
  onLogout,
  initialShirts,
  publicProfile,
  readOnly = false,
  defaultViewMode = "collection",
}: ShirtCollectionAppProps) {
  const searchParams = useSearchParams();
  const sportFromUrl = searchParams.get("sport");
  const routeSportFilter: "all" | Sport =
    sportFromUrl === "football" || sportFromUrl === "basketball" ? sportFromUrl : "all";
  const [shirts, setShirts] = useState<Shirt[]>(initialShirts ?? []);
  const [isLoading, setIsLoading] = useState(!initialShirts);
  const [profile, setProfile] = useState<Profile | null>(publicProfile ?? null);
  const [isViewingOwnPublicProfile, setIsViewingOwnPublicProfile] = useState(false);
  const [activePublicTab, setActivePublicTab] = useState<PublicShowcaseTab>("featured");
  const [publicBio, setPublicBio] = useState(publicProfile?.public_bio || publicBioFallback);
  const [isEditingPublicBio, setIsEditingPublicBio] = useState(false);
  const [featuredSearch, setFeaturedSearch] = useState("");
  const [debouncedFeaturedSearch, setDebouncedFeaturedSearch] = useState("");
  const [featuredQuickFilter, setFeaturedQuickFilter] = useState<FeaturedQuickFilter>("all");
  const [featuredOnlyAvailable, setFeaturedOnlyAvailable] = useState(true);
  const [featuredVisibleCount, setFeaturedVisibleCount] = useState(featuredSuggestionLimit);
  const [isFeaturedManagerOpen, setIsFeaturedManagerOpen] = useState(false);
  const viewMode =
    readOnly && activePublicTab !== "featured"
      ? activePublicTab === "all"
        ? "all"
        : activePublicTab
      : defaultViewMode;
  const [form, setForm] = useState<ShirtFormState>(defaultForm);
  const [filters, setFilters] = useState<ShirtFilters>(() => ({
    ...emptyFilters,
    sport: routeSportFilter,
  }));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingShirtId, setViewingShirtId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<
    | { type: "single"; id: string }
    | { type: "multiple"; count: number }
    | null
  >(null);
  const [sortBy, setSortBy] = useState<SortBy>({ field: "added", direction: "desc" });
  const [collectionViewStyle, setCollectionViewStyle] = useState<CollectionViewStyle>(() => {
    if (typeof window === "undefined") return "grid";
    const storedView = window.localStorage.getItem(viewPreferenceKey);
    return storedView === "compact" || storedView === "grid" ? storedView : "grid";
  });
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const formBackdropPointerStartedInsideRef = useRef(false);
  const [statsDetailKey, setStatsDetailKey] = useState<StatsDetailKey | null>(null);
  const [selectedStatsItem, setSelectedStatsItem] = useState<SelectedStatsItem | null>(null);

  const getResetFilters = (): ShirtFilters => ({
    ...emptyFilters,
    status: viewMode === "collection" || viewMode === "wishlist" ? viewMode : "all",
  });

  const handleCollectionViewStyleChange = (nextView: CollectionViewStyle) => {
    setCollectionViewStyle(nextView);
    window.localStorage.setItem(viewPreferenceKey, nextView);
  };
  useEffect(() => {
    if (!readOnly) {
      loadShirts();
      loadProfile();
    }
  }, [readOnly]);

  useEffect(() => {
    if (!readOnly || !profile?.id) return;

    let isMounted = true;

    const checkOwner = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (isMounted) {
        setIsViewingOwnPublicProfile(user?.id === profile.id);
      }
    };

    checkOwner();

    return () => {
      isMounted = false;
    };
  }, [profile?.id, readOnly]);

  useEffect(() => {
    const handlePopState = () => {
      setFilters((current) => ({
        ...current,
        sport: getSportFilterFromSearch(window.location.search),
      }));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (!isSortOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortOpen(false);
      }
    };

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSortOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [isSortOpen]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedFeaturedSearch(featuredSearch.trim());
    }, 240);

    return () => window.clearTimeout(timeoutId);
  }, [featuredSearch]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFeaturedVisibleCount(debouncedFeaturedSearch ? featuredSearchLimit : featuredSuggestionLimit);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [debouncedFeaturedSearch, featuredOnlyAvailable, featuredQuickFilter]);

  async function loadShirts() {
    if (readOnly) return;
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data, error } = await supabase
        .from("shirts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });
      if (!error && data) {
        setShirts(data as Shirt[]);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_public, show_collection, show_wishlist, public_bio, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
    }
  }

  const editingShirt = shirts.find((shirt) => shirt.id === editingId);
  const viewingShirt = shirts.find((shirt) => shirt.id === viewingShirtId);
  const isDetailOpen = Boolean(viewingShirt);
  const isShirtDetailOpen = isDetailOpen;
  const typeOptions = getTypeOptions(form.sport);
  const countryOptions = getCountryOptions(form.sport, form.category);
  const leagueOptions = getLeagueOptions(form.sport, form.category, form.country);
  const teamOptions = useMemo(
    () => mergeTeamOptions([...createTeamOptionsFromShirts(shirts), ...allTeamOptions]),
    [shirts],
  );
  
  const viewModeFilteredShirts = shirts.filter((shirt) => {
    if (viewMode === "collection") return shirt.status === "collection";
    if (viewMode === "wishlist") return shirt.status === "wishlist";
    return true;
  });
  
  const filteredShirts = viewModeFilteredShirts.filter((shirt) => matchesFilters(shirt, filters));
  const drawerStats = useMemo(() => {
    const collectionCount = shirts.filter((shirt) => shirt.status === "collection").length;
    const wishlistCount = shirts.filter((shirt) => shirt.status === "wishlist").length;

    return {
      total: shirts.length,
      collection: collectionCount,
      wishlist: wishlistCount,
    };
  }, [shirts]);
  const stats = useMemo(() => {
    const collection = filteredShirts.filter((shirt) => shirt.status === "collection");
    const wishlist = filteredShirts.filter((shirt) => shirt.status === "wishlist");

    const topTeams = countBy(filteredShirts, "teams");
    const topLeagues = countBy(filteredShirts, "leagues");
    const topSeasons = countBy(filteredShirts, "seasons");
    const topPlayers = countBy(filteredShirts, "players");
    const topNumbers = countBy(filteredShirts, "numbers");
    const topCountries = countBy(filteredShirts, "countries");
    const topKitTypes = countBy(filteredShirts, "kitTypes");
    const topSizes = countBy(filteredShirts, "sizes");

    return {
      totalShirts: filteredShirts.length,
      collectionCount: collection.length,
      wishlistCount: wishlist.length,
      topTeam: topTeams[0] ?? null,
      topLeague: topLeagues[0] ?? null,
      topSeason: topSeasons[0] ?? null,
      topPlayer: topPlayers[0] ?? null,
      topNumber: topNumbers[0] ?? null,
      topCountry: topCountries[0] ?? null,
      topKitType: topKitTypes[0] ?? null,
      topSize: topSizes[0] ?? null,
      uniqueCountries: topCountries.length,
      topTeams,
      topLeagues,
      topSeasons,
      topPlayers,
      topNumbers,
      topCountries,
      topKitTypes,
      topSizes,
    };
  }, [filteredShirts]);
  const getCreatedTimestamp = (shirt: Shirt) => {
    const value = Date.parse(shirt.created_at ?? "");
    return Number.isNaN(value) ? 0 : value;
  };

  const numberValue = (value: string | number | undefined) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const seasonValue = (value: string | undefined) => {
    const match = value?.match(/\d{4}/);
    return match ? Number(match[0]) : null;
  };

  const compareNullableNumbers = (left: number | null, right: number | null, direction: SortDirection) => {
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return direction === "asc" ? left - right : right - left;
  };

  const toggleSort = (field: SortField) => {
    setSortBy((current) => {
      if (current.field !== field) {
        return {
          field,
          direction: defaultSortDirectionByField[field],
        };
      }

      return {
        field,
        direction: current.direction === "asc" ? "desc" : "asc",
      };
    });
    setIsSortOpen(false);
  };

  const sortedShirts = (() => {
    const list = [...filteredShirts];
    const directionFactor = sortBy.direction === "asc" ? 1 : -1;

    switch (sortBy.field) {
      case "added":
        return list.sort((a, b) => (getCreatedTimestamp(a) - getCreatedTimestamp(b)) * directionFactor);
      case "team":
        return list.sort(
          (a, b) => a.team.localeCompare(b.team, undefined, { sensitivity: "base" }) * directionFactor,
        );
      case "player":
        return list.sort(
          (a, b) =>
            (a.player || "").localeCompare(b.player || "", undefined, { sensitivity: "base" }) *
            directionFactor,
        );
      case "number":
        return list.sort((a, b) => {
          const numberComparison = compareNullableNumbers(numberValue(a.number), numberValue(b.number), sortBy.direction);
          if (numberComparison !== 0) return numberComparison;
          return (a.number || "").localeCompare(b.number || "", undefined, { sensitivity: "base" });
        });
      case "season":
        return list.sort((a, b) => {
          const seasonComparison = compareNullableNumbers(seasonValue(a.season), seasonValue(b.season), sortBy.direction);
          if (seasonComparison !== 0) return seasonComparison;
          return (a.season || "").localeCompare(b.season || "", undefined, { sensitivity: "base" }) * directionFactor;
        });
    }
  })();
  const collectionTotal = shirts.filter((shirt) => shirt.status === "collection").length;
  const wishlistTotal = shirts.filter((shirt) => shirt.status === "wishlist").length;
  const featuredShirts = shirts
    .filter((shirt) => shirt.is_featured)
    .sort((left, right) => {
      const leftOrder = left.featured_order ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.featured_order ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return getCreatedTimestamp(right) - getCreatedTimestamp(left);
    })
    .slice(0, featuredLimit);
  const displayShirts = readOnly && activePublicTab === "featured" ? featuredShirts : sortedShirts;
  const effectiveCollectionViewStyle = readOnly ? "grid" : collectionViewStyle;
  const featuredSearchTerm = debouncedFeaturedSearch.toLowerCase();
  const featuredResultLimit = debouncedFeaturedSearch ? featuredSearchLimit : featuredSuggestionLimit;
  const featuredCandidateShirts = shirts
    .filter((shirt) => {
      if (featuredQuickFilter !== "all" && shirt.status !== featuredQuickFilter) return false;
      if (featuredOnlyAvailable && shirt.is_featured) return false;

      if (!featuredSearchTerm) return true;

      const searchableText = [
        shirt.team,
        shirt.country,
        shirt.season,
        shirt.player,
        shirt.number,
        shirt.league,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(featuredSearchTerm);
    })
    .sort((left, right) => {
      if (Boolean(left.is_featured) !== Boolean(right.is_featured)) {
        return left.is_featured ? 1 : -1;
      }

      if (featuredQuickFilter === "all" && left.status !== right.status) {
        return left.status === "collection" ? -1 : 1;
      }

      const leftSeason = seasonValue(left.season) ?? 0;
      const rightSeason = seasonValue(right.season) ?? 0;
      if (leftSeason !== rightSeason) return rightSeason - leftSeason;

      const teamComparison = left.team.localeCompare(right.team, undefined, { sensitivity: "base" });
      if (teamComparison !== 0) return teamComparison;

      return getCreatedTimestamp(right) - getCreatedTimestamp(left);
    });
  const visibleFeaturedCandidates = featuredCandidateShirts.slice(0, featuredVisibleCount);
  const hasMoreFeaturedCandidates = featuredCandidateShirts.length > visibleFeaturedCandidates.length;
  const filterOptions = getFilterOptions(viewModeFilteredShirts, filters);

  const closeForm = () => {
    setEditingId(null);
    setForm(defaultForm);
    setIsFormOpen(false);
  };

  const clearSelection = () => setSelectedIds([]);

  const toggleSelect = (id: string) => {
    if (readOnly) return;
    setSelectedIds((current) => (current.includes(id) ? current.filter((x) => x !== id) : [id, ...current]));
  };

  const isSelectionMode = !readOnly && selectedIds.length > 0;
  const isSelectModeActive = isSelectionMode;

  const openCreateForm = () => {
    if (readOnly) return;
    const nextForm: ShirtFormState = {
      ...defaultForm,
      status: viewMode === "wishlist" ? "wishlist" : viewMode === "collection" ? "collection" : defaultForm.status,
      sport: filters.sport === "football" || filters.sport === "basketball" ? filters.sport : defaultForm.sport,
    };

    setEditingId(null);
    setForm(nextForm);
    setIsFormOpen(true);
  };

  const handleSportChange = (sport: Sport | "") => {
    setForm((current) => ({
      ...current,
      sport,
      category: "",
      country: "",
      league: "",
      team: current.team === "custom" ? "custom" : "",
      customTeam: current.team === "custom" ? current.customTeam : "",
    }));
  };

  const handleCategoryChange = (category: ShirtCategory | "") => {
    setForm((current) => ({
      ...current,
      category,
      country: "",
      league: "",
      team: current.team === "custom" ? "custom" : "",
      customTeam: current.team === "custom" ? current.customTeam : "",
    }));
  };

  const handleCountryChange = (country: string) => {
    setForm((current) => ({
      ...current,
      country,
      league: "",
      team: current.team === "custom" ? "custom" : "",
      customTeam: current.team === "custom" ? current.customTeam : "",
    }));
  };

  const handleLeagueChange = (league: string) => {
    setForm((current) => ({
      ...current,
      league,
      team: current.team === "custom" ? "custom" : "",
      customTeam: current.team === "custom" ? current.customTeam : "",
    }));
  };

  const handleFieldChange = <K extends keyof ShirtFormState>(
    field: K,
    value: ShirtFormState[K],
  ) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleTeamSelect = (option: TeamOption) => {
    setForm((current) => ({
      ...current,
      sport: option.sport,
      category: option.category,
      country: option.country,
      league: option.league,
      team: option.team,
      customTeam: "",
    }));
  };

  const handleCustomTeam = (value: string) => {
    setForm((current) => ({
      ...current,
      team: "custom",
      customTeam: value,
    }));
  };

  const handleSubmit = async () => {
    if (readOnly) return;
    const team = form.team === "custom" ? form.customTeam.trim() : form.team;

    if (!team || !form.sport || !form.category || !form.season.trim() || !form.kitType) {
      notify.error("Completa equipo, deporte, tipo, temporada y equipación.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notify.error("Sesión expirada, inicia sesión otra vez.");
      return;
    }

    const payload = {
      id: editingId || crypto.randomUUID(),
      sport: (form.sport || "football") as Sport,
      category: (form.category || "club") as ShirtCategory,
      country: form.country.trim(),
      league: form.league.trim(),
      team,
      season: form.season.trim(),
      player: form.player.trim(),
      number: form.number.trim(),
      kitType: form.kitType,
      size: form.size,
      status: (form.status || "collection") as ShirtStatus,
      images: form.images,
      mainImageId: form.mainImageId || form.images[0]?.id || "",
      notes: form.notes.trim(),
      user_id: user.id,
    };


    let result;

    if (editingId) {
      result = await supabase
        .from("shirts")
        .update(payload)
        .eq("id", editingId)
        .eq("user_id", user.id)
        .select();
    } else {
      result = await supabase
        .from("shirts")
        .insert([payload])
        .select();
    }


    if (result.error) {
      notify.error(result.error.message || "Error guardando camiseta.");
      return;
    }

    await loadShirts();
    closeForm();
    notify.success(editingId ? "Cambios guardados" : "Camiseta creada correctamente");
  };

  const handleEdit = (shirt: Shirt) => {
    if (readOnly) return;
    setEditingId(shirt.id);
    setForm(formFromShirt(shirt));
    setIsFormOpen(true);
  };

  const handleDeleteRequested = (id: string) => {
    if (readOnly) return;
    setDeleteConfirmation({ type: "single", id });
  };

  const handleDeleteMultipleRequested = () => {
    if (readOnly) return;
    if (selectedIds.length === 0) return;
    setDeleteConfirmation({ type: "multiple", count: selectedIds.length });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.type === "single") {
      await handleDelete(deleteConfirmation.id);
    } else {
      const count = deleteConfirmation.count;
      setShirts((current) => current.filter((shirt) => !selectedIds.includes(shirt.id)));
      clearSelection();
      notify.success(`${count} camisetas eliminadas`);
    }

    setDeleteConfirmation(null);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation(null);
  };

  useEffect(() => {
    if (!isFormOpen && !deleteConfirmation) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      if (deleteConfirmation) {
        handleCancelDelete();
        return;
      }

      if (isFormOpen) {
        closeForm();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [deleteConfirmation, isFormOpen]);

  const handleDelete = async (id: string) => {
    const shirt = shirts.find((s) => s.id === id);

    if (!shirt) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notify.error("Sesión expirada, inicia sesión otra vez.");
      return;
    }

    // BORRAR IMAGENES STORAGE
    if (shirt.images?.length) {

      const filesToDelete = shirt.images
        .map((img) => {
          if (!img.url.includes("/storage/v1/object/public/shirts/")) {
            return null;
          }

          return img.url.split(
            "/storage/v1/object/public/shirts/"
          )[1];

        })
        .filter((file): file is string => Boolean(file))

      if (filesToDelete.length) {
        const { error: removeError } = await supabase.storage
          .from("shirts")
          .remove(filesToDelete);

        if (removeError) {
          console.error("STORAGE DELETE ERROR:", removeError);
        }
      }
    }

    // BORRAR ROW BD
    const { error } = await supabase
      .from("shirts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      notify.error(error.message || "Error eliminando camiseta.");
      return;
    }

    await loadShirts();
    notify.success("Camiseta eliminada correctamente");

    if (editingId === id) {
      closeForm();
    }
  };

  const handleToggleWishlist = async (id: string) => {
    if (readOnly) return;

    const shirt = shirts.find((item) => item.id === id);

    if (!shirt) {
      notify.error("No se ha encontrado la camiseta.");
      return;
    }

    const nextStatus: ShirtStatus = shirt.status === "wishlist" ? "collection" : "wishlist";
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notify.error("Sesión expirada, inicia sesión otra vez.");
      return;
    }

    const { data, error } = await supabase
      .from("shirts")
      .update({ status: nextStatus })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error || !data) {
      notify.error(error?.message || "No se pudo actualizar la camiseta. Revisa permisos/RLS.");
      return;
    }

    setShirts((current) => current.map((item) => (item.id === id ? (data as Shirt) : item)));
    notify.success(nextStatus === "collection" ? "Camiseta movida a colección" : "Camiseta movida a wishlist");
  };

  const handleCardClick = (id: string) => {
    if (!readOnly && isSelectModeActive) {
      toggleSelect(id);
      return;
    }
    setIsSortOpen(false);
    setViewingShirtId(id);
  };

  const handleDeleteMultiple = () => {
    if (selectedIds.length === 0) return;
    setShirts((current) => current.filter((s) => !selectedIds.includes(s.id)));
    clearSelection();
  };

  const handleMoveToCollection = async () => {
    if (selectedIds.length === 0) return;

    const idsToUpdate = [...selectedIds];
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notify.error("Sesión expirada, inicia sesión otra vez.");
      return;
    }

    const { data, error } = await supabase
      .from("shirts")
      .update({ status: "collection" })
      .in("id", idsToUpdate)
      .eq("user_id", user.id)
      .select("*");

    if (error || !data || data.length !== idsToUpdate.length) {
      await loadShirts();
      notify.error(error?.message || "No se pudieron mover todas las camisetas. Revisa permisos/RLS.");
      return;
    }

    const updatedById = new Map((data as Shirt[]).map((shirt) => [shirt.id, shirt]));
    setShirts((current) => current.map((shirt) => updatedById.get(shirt.id) ?? shirt));
    clearSelection();
    notify.success(idsToUpdate.length === 1 ? "Camiseta movida a colección" : "Camisetas movidas a colección");
  };

  const handleFilterChange = <K extends keyof ShirtFilters>(field: K, value: ShirtFilters[K]) => {
    setFilters((current) => {
      return { ...current, [field]: value };
    });
  };

  const persistPublicBio = async (nextBio: string) => {
    if (!isViewingOwnPublicProfile || !profile?.id) return;

    setPublicBio(nextBio);
    const { error } = await supabase
      .from("profiles")
      .update({ public_bio: nextBio.trim() || null })
      .eq("id", profile.id);

    if (error) {
      notify.error(error.message || "No se pudo guardar la bio.");
    }
  };

  const applyFeaturedUpdates = async (updates: Array<{ id: string; is_featured: boolean; featured_order: number | null }>) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      notify.error("Sesión expirada, inicia sesión otra vez.");
      return;
    }

    const results = await Promise.all(
      updates.map((update) =>
        supabase
          .from("shirts")
          .update({
            is_featured: update.is_featured,
            featured_order: update.featured_order,
          })
          .eq("id", update.id)
          .eq("user_id", user.id)
          .select("*")
          .single(),
      ),
    );

    const firstError = results.find((result) => result.error)?.error;
    if (firstError) {
      notify.error(firstError.message || "No se pudieron guardar las destacadas.");
      return false;
    }

    const updatedById = new Map(
      results
        .map((result) => result.data)
        .filter((shirt): shirt is Shirt => Boolean(shirt))
        .map((shirt) => [shirt.id, shirt]),
    );

    setShirts((current) => current.map((shirt) => updatedById.get(shirt.id) ?? shirt));
    return true;
  };

  const toggleFeaturedShirt = async (shirtId: string) => {
    if (!isViewingOwnPublicProfile) return;

    const shirt = shirts.find((item) => item.id === shirtId);
    if (!shirt) return;

    if (shirt.is_featured) {
      const remainingFeatured = featuredShirts.filter((item) => item.id !== shirtId);
      const updates = [
        { id: shirtId, is_featured: false, featured_order: null },
        ...remainingFeatured.map((item, index) => ({
          id: item.id,
          is_featured: true,
          featured_order: index + 1,
        })),
      ];

      if (await applyFeaturedUpdates(updates)) {
        notify.success("Destacada actualizada");
      }
      return;
    }

    if (featuredShirts.length >= featuredLimit) {
      notify.error(`Puedes destacar un máximo de ${featuredLimit} camisetas. Quita una antes de añadir otra.`);
      return;
    }

    if (
      await applyFeaturedUpdates([
        {
          id: shirtId,
          is_featured: true,
          featured_order: featuredShirts.length + 1,
        },
      ])
    ) {
      notify.success("Camiseta destacada");
    }
  };

  const moveFeaturedShirt = async (shirtId: string, direction: -1 | 1) => {
    if (!isViewingOwnPublicProfile) return;

    const currentIndex = featuredShirts.findIndex((shirt) => shirt.id === shirtId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= featuredShirts.length) return;

    const currentShirt = featuredShirts[currentIndex];
    const nextShirt = featuredShirts[nextIndex];

    if (
      await applyFeaturedUpdates([
        {
          id: currentShirt.id,
          is_featured: true,
          featured_order: nextIndex + 1,
        },
        {
          id: nextShirt.id,
          is_featured: true,
          featured_order: currentIndex + 1,
        },
      ])
    ) {
      notify.success("Orden actualizado");
    }
  };

  const handleSharePublicProfile = async () => {
    if (!profile?.username || typeof window === "undefined") return;

    const shareUrl = `${window.location.origin}/u/${profile.username}`;

    if (navigator.share) {
      await navigator.share({
        title: `${profile.display_name || profile.username} | Football Kit Archive`,
        text: "Mira esta vitrina de camisetas.",
        url: shareUrl,
      });
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    notify.success("Enlace copiado");
  };

  const statsDetail = (() => {
    if (!statsDetailKey) return null;

    const shirtListByKey: Partial<Record<StatsDetailKey, Shirt[]>> = {
      all: filteredShirts,
      collection: filteredShirts.filter((shirt) => shirt.status === "collection"),
      wishlist: filteredShirts.filter((shirt) => shirt.status === "wishlist"),
    };

    const rankingByKey: Partial<Record<StatsDetailKey, StatsRankingEntry[]>> = {
      countries: stats.topCountries,
      teams: stats.topTeams,
      leagues: stats.topLeagues,
      seasons: stats.topSeasons,
      players: stats.topPlayers,
      numbers: stats.topNumbers,
      kitTypes: stats.topKitTypes,
      sizes: stats.topSizes,
    };

    const titleByKey: Record<StatsDetailKey, string> = {
      all: "Todas las camisetas",
      collection: "Camisetas en colección",
      wishlist: "Camisetas en wishlist",
      countries: "Países completos",
      teams: "Clubes completos",
      leagues: "Ligas completas",
      seasons: "Temporadas completas",
      players: "Jugadores completos",
      numbers: "Dorsales completos",
      kitTypes: "Equipaciones completas",
      sizes: "Tallas completas",
    };

    return {
      key: statsDetailKey,
      title: titleByKey[statsDetailKey],
      shirts: shirtListByKey[statsDetailKey],
      entries: rankingByKey[statsDetailKey],
    };
  })();

  useEffect(() => {
    if (!statsDetailKey && !selectedStatsItem) return;

    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selectedStatsItem) {
          setSelectedStatsItem(null);
          return;
        }
        setStatsDetailKey(null);
      }
    };

    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("keydown", handleEsc);
    };
  }, [selectedStatsItem, statsDetailKey]);

  const getShirtsForStatsItem = (key: StatsDetailKey, entry: StatsRankingEntry) =>
    filteredShirts.filter((shirt) => normalizeStatsKey(getStatsValue(shirt, key)) === entry.key);

  const renderViewIcon = (style: CollectionViewStyle) => (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
        {style === "compact" ? (
          <>
            <path d="M8 6h12" />
            <path d="M8 12h12" />
            <path d="M8 18h12" />
            <path d="M4 6h.01" />
            <path d="M4 12h.01" />
            <path d="M4 18h.01" />
          </>
        ) : (
          <>
            <path d="M4 4h6v6H4z" />
            <path d="M14 4h6v6h-6z" />
            <path d="M4 14h6v6H4z" />
            <path d="M14 14h6v6h-6z" />
          </>
        )}
      </g>
    </svg>
  );

  const viewStyleControl = (
    <div className="view-style-toggle" role="group" aria-label="Selector de vista">
      <button
        type="button"
        className={collectionViewStyle === "compact" ? "is-active" : ""}
        aria-pressed={collectionViewStyle === "compact"}
        aria-label="Vista compacta"
        title="Vista compacta"
        onClick={() => handleCollectionViewStyleChange("compact")}
      >
        {renderViewIcon("compact")}
      </button>
      <button
        type="button"
        className={collectionViewStyle === "grid" ? "is-active" : ""}
        aria-pressed={collectionViewStyle === "grid"}
        aria-label="Vista grid"
        title="Vista grid"
        onClick={() => handleCollectionViewStyleChange("grid")}
      >
        {renderViewIcon("grid")}
      </button>
    </div>
  );

  const getStatsItemTitle = (key: StatsDetailKey, name: string) => {
    if (key === "numbers") return `Dorsal #${name}`;
    return name;
  };

  const getShirtImageUrl = (shirt: Shirt) => {
    const mainImage = shirt.images.find((img) => img.id === shirt.mainImageId) || shirt.images[0];
    return mainImage?.url || placeholderImages[shirt.sport] || placeholderImages.default;
  };

  const getFeaturedResultTitle = (shirt: Shirt) =>
    [shirt.team.trim() || shirt.country.trim() || "Camiseta", shirt.season.trim()].filter(Boolean).join(" ");

  const getFeaturedResultSubtitle = (shirt: Shirt) => {
    const player = shirt.player.trim();
    const number = shirt.number.trim();
    if (player && number) return `${player} · #${number}`;
    if (player) return player;
    if (number) return `#${number}`;
    return shirt.league.trim() || shirt.country.trim() || "Sin jugador";
  };

  const renderFeaturedSelectedItem = (shirt: Shirt, index: number) => (
    <article key={shirt.id} className="featured-selected-card">
      <div className="featured-selected-thumb">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={getShirtImageUrl(shirt)} alt={`${shirt.team} ${shirt.season}`} loading="lazy" />
      </div>
      <div className="featured-selected-copy">
        <span className="featured-selected-order">#{index + 1}</span>
        <strong>{getFeaturedResultTitle(shirt)}</strong>
        <small>{getFeaturedResultSubtitle(shirt)}</small>
      </div>
      <div className="featured-selected-actions">
        <button type="button" onClick={() => moveFeaturedShirt(shirt.id, -1)} disabled={index === 0} aria-label="Subir destacada">
          ↑
        </button>
        <button
          type="button"
          onClick={() => moveFeaturedShirt(shirt.id, 1)}
          disabled={index === featuredShirts.length - 1}
          aria-label="Bajar destacada"
        >
          ↓
        </button>
        <button type="button" className="is-remove" onClick={() => toggleFeaturedShirt(shirt.id)}>
          Quitar
        </button>
      </div>
    </article>
  );

  const renderFeaturedCandidate = (shirt: Shirt) => {
    const isLimitReached = featuredShirts.length >= featuredLimit && !shirt.is_featured;

    return (
      <article key={shirt.id} className={`featured-result-row ${shirt.is_featured ? "is-featured" : ""}`}>
        <div className="featured-result-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getShirtImageUrl(shirt)} alt={`${shirt.team} ${shirt.season}`} loading="lazy" />
        </div>
        <div className="featured-result-copy">
          <strong>{getFeaturedResultTitle(shirt)}</strong>
          <span>{getFeaturedResultSubtitle(shirt)}</span>
          <small>{statusLabels[shirt.status]}</small>
        </div>
        <button
          type="button"
          onClick={() => toggleFeaturedShirt(shirt.id)}
          disabled={shirt.is_featured || isLimitReached}
          aria-label={`Destacar ${shirt.team} ${shirt.season}`}
        >
          {shirt.is_featured ? "Destacada" : "Destacar"}
        </button>
      </article>
    );
  };

  const renderFeaturedEditorialShowcase = () => {
    return (
      <section className="collection-grid featured-collection-grid">
        {featuredShirts.map((shirt, index) => (
          <div key={shirt.id} className={`featured-card-shell ${index === 0 ? "is-primary" : ""}`}>
            <span className="featured-card-order">{index === 0 ? "#1 destacada" : `#${index + 1}`}</span>
            <ShirtCard
              shirt={shirt}
              onCardClick={handleCardClick}
              onEdit={handleEdit}
              onDelete={handleDeleteRequested}
              onToggleWishlist={handleToggleWishlist}
              isSelectModeActive={isSelectModeActive}
              isSelected={selectedIds.includes(shirt.id)}
              onToggleSelect={toggleSelect}
              readOnly={readOnly}
            />
          </div>
        ))}
      </section>
    );
  };

  const renderCompactRow = (shirt: Shirt) => {
    const isWishlist = shirt.status === "wishlist";
    const playerLabel = shirt.player.trim() || "Sin jugador";
    const playerNumberLabel = shirt.number.trim() ? `${playerLabel} · #${shirt.number.trim()}` : playerLabel;
    const kitLabel = shirt.kitType.trim() || "Sin equipación";
    const locationLabel = [shirt.league.trim(), shirt.country.trim()].filter(Boolean).join(" · ") || "Sin liga";
    const detailLabel = [shirt.league.trim(), shirt.country.trim(), kitLabel].filter(Boolean).join(" · ");
    const isSelected = selectedIds.includes(shirt.id);

    return (
      <article
        key={shirt.id}
        className={`compact-shirt-row ${isSelectModeActive ? "selection-active" : ""} ${isSelected ? "is-selected" : ""}`}
        onClick={() => handleCardClick(shirt.id)}
      >
        {!readOnly ? (
          <button
            className={`compact-select-checkbox ${isSelected ? "checked" : ""}`}
            type="button"
            aria-pressed={isSelected}
            aria-label={isSelected ? "Deseleccionar" : "Seleccionar"}
            onClick={(event) => {
              event.stopPropagation();
              toggleSelect(shirt.id);
            }}
          >
            {isSelected ? "✓" : ""}
          </button>
        ) : null}

        <div className="compact-shirt-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={getShirtImageUrl(shirt)} alt={`${shirt.team} ${shirt.season}`} loading="lazy" />
        </div>

        <div className="compact-shirt-main">
          <p className="compact-shirt-title">{shirt.team} - {shirt.season}</p>
          <p className="compact-shirt-subtitle">{playerNumberLabel}</p>
          <p className="compact-shirt-detail">{detailLabel}</p>
        </div>

        <div className="compact-shirt-meta compact-shirt-kit">
          <span>Equipación</span>
          <strong>{kitLabel}</strong>
        </div>

        <div className="compact-shirt-meta compact-shirt-location">
          <span>Liga · País</span>
          <strong>{locationLabel}</strong>
        </div>

        <button
          className={`shirt-card-badge compact-status ${isWishlist ? "badge-wishlist" : "badge-collection"}`}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!readOnly && isWishlist) {
              handleToggleWishlist(shirt.id);
            }
          }}
          aria-label={isWishlist ? "Mover a colección" : "Estado colección"}
          disabled={readOnly || !isWishlist}
        >
          {statusLabels[shirt.status]}
        </button>

        {!readOnly ? (
          <div className="compact-row-actions" aria-label="Acciones rápidas">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleEdit(shirt);
              }}
              aria-label="Editar camiseta"
            >
              ✎
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteRequested(shirt.id);
              }}
              aria-label="Eliminar camiseta"
            >
              ×
            </button>
          </div>
        ) : null}
      </article>
    );
  };

  const getRankingPresenceIcons = (entry: StatsRankingEntry) => {
    if (entry.collection > 0 && entry.wishlist > 0) return "Colección + Wishlist";
    if (entry.collection > 0) return "Colección";
    return "Wishlist";
  };

  const renderStatsDistribution = (entry: StatsRankingEntry) => {
    const collectionPercent = entry.total > 0 ? (entry.collection / entry.total) * 100 : 0;
    const wishlistPercent = entry.total > 0 ? (entry.wishlist / entry.total) * 100 : 0;

    return (
      <span className="stats-distribution">
        <span className="stats-breakdown">
          <span className="stats-breakdown-item is-collection">Colección: {entry.collection}</span>
          <span className="stats-breakdown-item is-wishlist">Wishlist: {entry.wishlist}</span>
          <span className="stats-breakdown-item">Total: {entry.total}</span>
        </span>
        <span className="stats-stacked-bar" aria-hidden="true">
          <span
            className="stats-stacked-segment is-collection"
            style={{ width: `${collectionPercent}%` }}
          ></span>
          <span
            className="stats-stacked-segment is-wishlist"
            style={{ width: `${wishlistPercent}%` }}
          ></span>
        </span>
      </span>
    );
  };

  const renderCollectionWishlistDistribution = () => {
    const collectionPercent = stats.totalShirts > 0 ? (stats.collectionCount / stats.totalShirts) * 100 : 0;
    const wishlistPercent = stats.totalShirts > 0 ? (stats.wishlistCount / stats.totalShirts) * 100 : 0;

    return (
      <button
        type="button"
        className="stats-card rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-lg shadow-slate-950/20 backdrop-blur-xl"
        onClick={() => setStatsDetailKey("all")}
      >
        <span className="text-sm font-medium text-slate-400">Distribución colección/wishlist</span>
        <span className="mt-2 block text-3xl font-bold text-white">{stats.totalShirts}</span>
        <span className="stats-distribution">
          <span className="stats-breakdown">
            <span className="stats-breakdown-item is-collection">Colección: {stats.collectionCount}</span>
            <span className="stats-breakdown-item is-wishlist">Wishlist: {stats.wishlistCount}</span>
          </span>
          <span className="stats-stacked-bar" aria-hidden="true">
            <span
              className="stats-stacked-segment is-collection"
              style={{ width: `${collectionPercent}%` }}
            />
            <span
              className="stats-stacked-segment is-wishlist"
              style={{ width: `${wishlistPercent}%` }}
            />
          </span>
        </span>
        <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
          Ver listado
        </span>
      </button>
    );
  };

  const handleStatsItemOpen = (key: StatsDetailKey, entry: StatsRankingEntry) => {
    setSelectedStatsItem({ key, entry });
  };

  const closeStatsDetail = () => {
    setStatsDetailKey(null);
  };

  const closeSelectedStatsItem = () => {
    setSelectedStatsItem(null);
  };

  const renderStatButton = (
    key: StatsDetailKey,
    label: string,
    value: string | number,
    helper?: string,
    className = "",
  ) => (
    <button
      type="button"
      className={`stats-card rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-lg shadow-slate-950/20 backdrop-blur-xl ${className}`}
      onClick={() => setStatsDetailKey(key)}
    >
      <span className="text-sm font-medium text-slate-400">{label}</span>
      <span className="mt-2 block text-3xl font-bold text-white">{value}</span>
      {helper ? <span className="mt-1 block text-sm text-slate-400">{helper}</span> : null}
      <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
        Ver listado
      </span>
    </button>
  );

  const renderTopCard = (
    key: StatsDetailKey,
    label: string,
    entry: StatsRankingEntry | null,
    className = "",
  ) => (
    <button
      type="button"
      className={`stats-card rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-lg shadow-slate-950/20 backdrop-blur-xl ${className}`}
      onClick={() => setStatsDetailKey(key)}
    >
      <span className="text-sm font-medium text-slate-400">{label}</span>
      {entry ? (
        <>
          <span className="mt-2 block text-2xl font-bold text-white">{entry.name}</span>
          <span className="stats-presence-icons" aria-label="Presencia en colección y wishlist">
            {getRankingPresenceIcons(entry)}
          </span>
          {renderStatsDistribution(entry)}
        </>
      ) : (
        <span className="mt-2 block text-slate-400">Sin datos</span>
      )}
      <span className="mt-4 inline-flex text-xs font-semibold uppercase tracking-[0.16em] text-teal-200">
        Ver detalle
      </span>
    </button>
  );

  const selectedStatsShirts = selectedStatsItem
    ? getShirtsForStatsItem(selectedStatsItem.key, selectedStatsItem.entry)
    : [];
  const hasNoPublicSections =
    readOnly && profile?.show_collection === false && profile?.show_wishlist === false;
  const isMenuOpen = isDrawerOpen;
  const isAnyOverlayOpen =
    isFiltersOpen ||
    isFormOpen ||
    Boolean(deleteConfirmation) ||
    Boolean(statsDetail) ||
    Boolean(selectedStatsItem);
  const hasActiveFilters =
    filters.search.trim() !== "" ||
    filters.sport !== "all" ||
    filters.category !== "all" ||
    filters.status !== "all" ||
    filters.country !== "all" ||
    filters.league !== "all" ||
    filters.team !== "all" ||
    filters.year.trim() !== "";
  const shouldShowFloatingActions =
    !readOnly && !isAnyOverlayOpen && !isDetailOpen && !isMenuOpen && !isSelectionMode;
  const shouldShowSelectionBar =
    !readOnly &&
    isSelectionMode &&
    !isAnyOverlayOpen &&
    !isDetailOpen &&
    !isMenuOpen;
  const pageTitle =
    readOnly
      ? profile?.display_name || profile?.username || "Camisetas"
      : viewMode === "wishlist"
        ? "Wishlist"
        : viewMode === "stats"
          ? "Estadísticas"
          : viewMode === "all"
            ? "Todas las camisetas"
            : "Mi colección";
  const sportContextLabel =
    filters.sport === "football" || filters.sport === "basketball" ? sportLabels[filters.sport] : "Todo";
  const publicDisplayName = profile?.display_name || profile?.username || "Coleccionista";
  const publicInitial = publicDisplayName.slice(0, 1).toUpperCase();
  const publicTabs: Array<{ id: PublicShowcaseTab; label: string; count: number }> = [
    { id: "featured", label: "Destacadas", count: featuredShirts.length },
    { id: "collection", label: "Colección", count: collectionTotal },
    { id: "wishlist", label: "Wishlist", count: wishlistTotal },
    { id: "all", label: "Todas", count: shirts.length },
  ];

  const publicSectionTitle =
    activePublicTab === "featured"
      ? "Selección destacada"
      : activePublicTab === "collection"
        ? "Colección"
        : activePublicTab === "wishlist"
          ? "Wishlist"
          : "Todas las camisetas";

  const renderPublicAvatar = () => (
    <div className="public-showcase-avatar" aria-hidden="true">
      {profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={profile.avatar_url} alt="" />
      ) : (
        <span>{publicInitial}</span>
      )}
    </div>
  );

  return (
    <main className="app-shell min-h-screen px-4 py-5 text-slate-100 sm:px-6 sm:py-7 lg:px-10">
      {!readOnly && onLogout ? (
        <AppDrawer
          profile={profile}
          onLogout={onLogout}
          stats={drawerStats}
          isSuppressed={isShirtDetailOpen}
          onOpenChange={setIsDrawerOpen}
          onSectionSelect={() => {
            setFilters((current) => ({
              ...current,
              sport: "all",
            }));
          }}
        />
      ) : null}
      {isLoading ? (
        <div className="mx-auto max-w-[1560px] space-y-5 sm:space-y-8">
          <div className="hero-panel">
            <div className="space-y-4">
              <div className="h-3 w-32 animate-shimmer rounded-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]"></div>
              <div className="h-10 w-64 animate-shimmer rounded-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]"></div>
              <div className="h-5 w-full max-w-2xl animate-shimmer rounded-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]"></div>
            </div>
            <div className="flex items-center gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-24 animate-shimmer rounded-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]"></div>
              ))}
            </div>
          </div>

          <section className="space-y-7">
            <div className="h-6 w-48 animate-shimmer rounded-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]"></div>

            <div className="collection-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-3xl border border-slate-700/30 bg-slate-900/50 shadow-lg">
                  <div className="aspect-square animate-shimmer bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]"></div>
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-full animate-shimmer rounded-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]"></div>
                    <div className="h-4 w-3/4 animate-shimmer rounded-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]"></div>
                    <div className="h-4 w-1/2 animate-shimmer rounded-full bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 bg-[length:200%_100%]"></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="mx-auto max-w-[1560px] space-y-5 sm:space-y-8">
          {isViewingOwnPublicProfile ? (
            <div className="public-owner-banner">
              <span>Estás viendo tu vitrina pública</span>
              <Link href="/">← Volver a mi colección</Link>
            </div>
          ) : null}

          {readOnly ? (
            <header className={`public-showcase-hero ${isViewingOwnPublicProfile ? "is-owner-view" : "is-visitor-view"}`}>
              <div className="public-showcase-main">
                {renderPublicAvatar()}
                <div className="public-showcase-copy">
                  <p className="eyebrow">Vitrina pública</p>
                  <h1>{publicDisplayName}</h1>
                  {profile?.username ? <p className="public-showcase-username">@{profile.username}</p> : null}
                  {isEditingPublicBio && isViewingOwnPublicProfile ? (
                    <label className="public-bio-editor">
                      <span>Bio corta</span>
                      <textarea
                        value={publicBio}
                        maxLength={180}
                        onChange={(event) => setPublicBio(event.target.value)}
                        onBlur={() => persistPublicBio(publicBio)}
                      />
                    </label>
                  ) : (
                    <p className="public-showcase-bio">{publicBio}</p>
                  )}
                  <div className="public-showcase-actions">
                    {isViewingOwnPublicProfile ? (
                      <button
                        className="ghost-button"
                        type="button"
                        onClick={() => setIsEditingPublicBio((current) => !current)}
                      >
                        {isEditingPublicBio ? "Cerrar edición" : "Editar bio"}
                      </button>
                    ) : (
                      <Link className="ghost-button public-create-button" href="/">
                        Crear mi vitrina
                      </Link>
                    )}
                    <button className="ghost-button" type="button" onClick={handleSharePublicProfile}>
                      Compartir perfil
                    </button>
                  </div>
                </div>
              </div>

              <div className="public-showcase-stats" aria-label="Resumen de la vitrina">
                <span>
                  <strong>{shirts.length}</strong>
                  Piezas
                </span>
                <span className="is-collection">
                  <strong>{collectionTotal}</strong>
                  Colección
                </span>
                <span className="is-wishlist">
                  <strong>{wishlistTotal}</strong>
                  Wishlist
                </span>
              </div>
            </header>
          ) : (
            <header className="hero-panel">
              <div className="hero-copy">
                <p className="eyebrow">Vitrina privada</p>
                <h1 className="hero-title">
                  {pageTitle}
                </h1>
                {viewMode !== "stats" ? (
                  <p className="hero-context">{sportContextLabel}</p>
                ) : null}
              </div>

              <div className="hero-stats" aria-label="Resumen de la colección">
                <span>{stats.totalShirts} piezas</span>
                <span>{stats.collectionCount} en colección</span>
                <span>{stats.wishlistCount} wishlist</span>
              </div>
            </header>
          )}

          {viewMode === "stats" ? (
            <>
              <section className="space-y-7">
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
                  {renderStatButton("all", "Total camisetas", stats.totalShirts)}
                  {renderStatButton("collection", "Colección", stats.collectionCount)}
                  {renderStatButton("wishlist", "Wishlist", stats.wishlistCount)}
                  {renderStatButton("countries", "Países únicos", stats.uniqueCountries)}
                  {renderCollectionWishlistDistribution()}
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  {renderTopCard("teams", "Club más repetido", stats.topTeam)}
                  {renderTopCard("leagues", "Liga más repetida", stats.topLeague)}
                  {renderTopCard("seasons", "Temporada más repetida", stats.topSeason)}
                  {renderTopCard("players", "Jugador más repetido", stats.topPlayer)}
                  {renderTopCard("numbers", "Dorsal más repetido", stats.topNumber)}
                  {renderTopCard("countries", "País más repetido", stats.topCountry)}
                  {renderTopCard("sizes", "Talla más repetida", stats.topSize)}
                  {renderTopCard("kitTypes", "Equipación más repetida", stats.topKitType)}
                </div>
              </section>

            </>
          ) : (
            <section className="space-y-5 sm:space-y-7">
              {readOnly ? (
                <nav className="public-showcase-tabs" aria-label="Secciones públicas">
                  {publicTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      className={activePublicTab === tab.id ? "is-active" : ""}
                      aria-pressed={activePublicTab === tab.id}
                      onClick={() => {
                        setActivePublicTab(tab.id);
                        setIsSortOpen(false);
                        setIsFeaturedManagerOpen(false);
                      }}
                    >
                      <span>{tab.label}</span>
                      <strong>{tab.count}</strong>
                    </button>
                  ))}
                </nav>
              ) : null}

              {readOnly && activePublicTab !== "featured" ? (
                <details
                  className="public-filters-disclosure"
                  open={isViewingOwnPublicProfile}
                >
                  <summary>Filtros avanzados</summary>
                  <FiltersBar
                    filters={filters}
                    leagues={filterOptions.leagues}
                    countries={filterOptions.countries}
                    onFilterChange={handleFilterChange}
                    onReset={() => setFilters(getResetFilters())}
                    showStatusFilter={activePublicTab === "all"}
                    onOpenChange={setIsFiltersOpen}
                    mobileOpen={isFiltersOpen}
                  />
                </details>
              ) : !readOnly ? (
                <FiltersBar
                  filters={filters}
                  leagues={filterOptions.leagues}
                  countries={filterOptions.countries}
                  onFilterChange={handleFilterChange}
                  onReset={() => setFilters(getResetFilters())}
                  showStatusFilter={viewMode === "all"}
                  toolbarSlot={viewStyleControl}
                  onOpenChange={setIsFiltersOpen}
                  mobileOpen={isFiltersOpen}
                />
              ) : null}

              <div className="collection-heading">
                <div>
                  <p className="eyebrow">
                    {readOnly ? "Museo personal" : viewMode === "all" ? "Todas las camisetas" : viewMode === "collection" ? "Colección" : "Wishlist"}
                  </p>
                  <h2>{readOnly ? publicSectionTitle : `${filteredShirts.length} camisetas visibles`}</h2>
                </div>
                {readOnly && activePublicTab === "featured" && isViewingOwnPublicProfile ? (
                  <button
                    type="button"
                    className="featured-manage-toggle"
                    onClick={() => setIsFeaturedManagerOpen((current) => !current)}
                    aria-expanded={isFeaturedManagerOpen}
                  >
                    {isFeaturedManagerOpen ? "Cerrar gestión" : "Gestionar destacadas"}
                  </button>
                ) : null}
              </div>

              {readOnly && activePublicTab === "featured" && isViewingOwnPublicProfile && isFeaturedManagerOpen ? (
                <div className="featured-curator-panel">
                  <div className="featured-curator-header">
                    <div>
                      <p className="eyebrow">Selección destacada</p>
                      <h3>Selección destacada</h3>
                    </div>
                    <span>{featuredShirts.length}/{featuredLimit} seleccionadas</span>
                  </div>

                  {featuredShirts.length > 0 ? (
                    <div className="featured-selected-list">
                      {featuredShirts.map(renderFeaturedSelectedItem)}
                    </div>
                  ) : (
                    <div className="featured-empty-curator">
                      <h4>Aún no hay destacadas</h4>
                      <p>Busca tus camisetas favoritas y selecciónalas para crear la sala principal de tu vitrina.</p>
                    </div>
                  )}

                  <div className="featured-search-panel">
                    <input
                      type="search"
                      value={featuredSearch}
                      placeholder="Buscar camiseta para destacar..."
                      onChange={(event) => setFeaturedSearch(event.target.value)}
                    />
                    <div className="featured-quick-filters" aria-label="Filtros rápidos de destacadas">
                      {(["all", "collection", "wishlist"] as FeaturedQuickFilter[]).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          className={featuredQuickFilter === filter ? "is-active" : ""}
                          onClick={() => setFeaturedQuickFilter(filter)}
                        >
                          {filter === "all" ? "Todas" : statusLabels[filter]}
                        </button>
                      ))}
                      <label>
                        <input
                          type="checkbox"
                          checked={featuredOnlyAvailable}
                          onChange={(event) => setFeaturedOnlyAvailable(event.target.checked)}
                        />
                        Solo no destacadas
                      </label>
                    </div>
                  </div>

                  {featuredShirts.length >= featuredLimit ? (
                    <p className="featured-limit-message">Ya tienes {featuredLimit} destacadas. Quita una para añadir otra.</p>
                  ) : null}

                  <div className="featured-results-list">
                    {visibleFeaturedCandidates.length > 0 ? (
                      visibleFeaturedCandidates.map(renderFeaturedCandidate)
                    ) : (
                      <div className="featured-results-empty">
                        <p>No hay camisetas que coincidan con esa búsqueda.</p>
                      </div>
                    )}
                  </div>

                  {hasMoreFeaturedCandidates ? (
                    <button
                      type="button"
                      className="featured-more-button"
                      onClick={() => setFeaturedVisibleCount((current) => current + featuredResultLimit)}
                    >
                      Ver más
                    </button>
                  ) : null}
                </div>
              ) : null}

              {readOnly && activePublicTab === "featured" ? (
                featuredShirts.length > 0 ? (
                  renderFeaturedEditorialShowcase()
                ) : (
                  <div className="featured-editorial-empty">
                    <div>
                      <p className="eyebrow">Sala principal</p>
                      <h3>Aún no hay piezas destacadas</h3>
                      <p>Selecciona hasta {featuredLimit} camisetas para crear la sala principal de tu vitrina.</p>
                    </div>
                    {isViewingOwnPublicProfile ? (
                      <button
                        type="button"
                        className="featured-manage-toggle"
                        onClick={() => setIsFeaturedManagerOpen(true)}
                      >
                        Gestionar destacadas
                      </button>
                    ) : null}
                  </div>
                )
              ) : displayShirts.length > 0 ? (
                effectiveCollectionViewStyle === "compact" ? (
                  <div className="compact-shirt-list">{displayShirts.map(renderCompactRow)}</div>
                ) : (
                  <div className={`collection-grid ${readOnly ? "public-collection-grid" : ""}`}>
                    {displayShirts.map((shirt) => (
                      <div key={shirt.id} className="public-card-shell">
                        <ShirtCard
                          shirt={shirt}
                          onCardClick={handleCardClick}
                          onEdit={handleEdit}
                          onDelete={handleDeleteRequested}
                          onToggleWishlist={handleToggleWishlist}
                          isSelectModeActive={isSelectModeActive}
                          isSelected={selectedIds.includes(shirt.id)}
                          onToggleSelect={toggleSelect}
                          readOnly={readOnly}
                        />
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className={`empty-state ${readOnly ? "public-empty-state" : ""}`}>
                  {hasNoPublicSections ? (
                    <>
                      <h3>Este usuario no comparte ninguna sección de su colección.</h3>
                      <p>El perfil público está activo, pero la colección y la wishlist no están visibles.</p>
                    </>
                  ) : (
                    <>
                      <h3>{activePublicTab === "featured" ? "Aún no hay destacadas" : "No hay camisetas con esos filtros"}</h3>
                      <p>
                        {readOnly
                          ? activePublicTab === "featured"
                            ? "Cuando el coleccionista seleccione piezas clave, aparecerán aquí como una sala principal."
                            : "Ajusta la búsqueda o cambia los filtros de la vitrina."
                          : "Ajusta la búsqueda o añade una nueva pieza a la vitrina."}
                      </p>
                    </>
                  )}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {shouldShowFloatingActions ? (
        <div className="floating-actions">
          <div className="sort-control" ref={sortDropdownRef}>
            <button
              type="button"
              className="sort-icon-button"
              aria-haspopup="menu"
              aria-expanded={isSortOpen}
              onClick={() => setIsSortOpen((current) => !current)}
              title="Ordenar por"
              aria-label="Ordenar"
            >
              ↕
            </button>

            {isSortOpen && (
              <div className="sort-dropdown floating-up" role="menu">
                {sortOptions.map((option) => {
                  const isActive = sortBy.field === option.field;
                  const directionLabel = sortBy.direction === "asc" ? option.ascLabel : option.descLabel;

                  return (
                    <button
                      key={option.field}
                      type="button"
                      role="menuitem"
                      className={isActive ? "is-active" : ""}
                      onClick={() => toggleSort(option.field)}
                    >
                      <span>{option.label}</span>
                      <small>{isActive ? directionLabel : option.ascLabel}</small>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {!readOnly ? (
            <button className="floating-add" type="button" onClick={openCreateForm}>
              <span className="floating-add-label-full">+ Añadir camiseta</span>
              <span className="floating-add-label-short">+ Añadir</span>
            </button>
          ) : null}

          <button
            className={`floating-view-button ${collectionViewStyle === "compact" ? "is-compact" : "is-grid"}`}
            type="button"
            onClick={() => {
              setIsSortOpen(false);
              handleCollectionViewStyleChange(collectionViewStyle === "compact" ? "grid" : "compact");
            }}
            aria-label={collectionViewStyle === "compact" ? "Cambiar a vista normal" : "Cambiar a vista compacta"}
            aria-pressed={collectionViewStyle === "compact"}
            title={collectionViewStyle === "compact" ? "Vista normal" : "Vista compacta"}
          >
            {renderViewIcon(collectionViewStyle === "compact" ? "grid" : "compact")}
          </button>

          <button
            className="floating-filter-button"
            type="button"
            onClick={() => {
              setIsSortOpen(false);
              setIsFiltersOpen((current) => !current);
            }}
            aria-label="Filtros"
            aria-expanded={isFiltersOpen}
            title="Filtros"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 6h16M7 12h10M10 18h4"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="1.9"
              />
            </svg>
          </button>

          {hasActiveFilters ? (
            <button
              className="floating-reset-button"
              type="button"
              onClick={() => {
                setIsSortOpen(false);
                setFilters(getResetFilters());
              }}
              aria-label="Limpiar filtros"
              title="Limpiar filtros"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
      {shouldShowSelectionBar && (
        <div className="floating-selection-bar" role="toolbar" aria-label="Acciones selección">
          <div className="selection-count">✓ {selectedIds.length} seleccionadas</div>
          <div className="selection-actions">
            <button className="ghost-button" type="button" onClick={handleDeleteMultipleRequested}>
              Eliminar seleccionadas
            </button>
            <button className="primary-button" type="button" onClick={handleMoveToCollection}>
              Mover a Colección
            </button>
            <button className="ghost-button" type="button" onClick={clearSelection}>
              Cancelar selección
            </button>
          </div>
        </div>
      )}

      {!readOnly && isFormOpen ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Formulario camiseta"
          onPointerDown={(event) => {
            formBackdropPointerStartedInsideRef.current = event.target !== event.currentTarget;
          }}
          onClick={(event) => {
            if (event.target !== event.currentTarget) return;
            if (formBackdropPointerStartedInsideRef.current) {
              formBackdropPointerStartedInsideRef.current = false;
              return;
            }
            closeForm();
          }}
        >
          <div className="modal-shell" onClick={(event) => event.stopPropagation()}>
            <ShirtForm
              form={form}
              editingShirt={editingShirt}
              typeOptions={typeOptions}
              countryOptions={countryOptions}
              leagueOptions={leagueOptions}
              allTeamOptions={teamOptions}
              onSubmit={handleSubmit}
              onCancel={closeForm}
              onSportChange={handleSportChange}
              onCategoryChange={handleCategoryChange}
              onCountryChange={handleCountryChange}
              onLeagueChange={handleLeagueChange}
              onTeamSelect={handleTeamSelect}
              onCustomTeam={handleCustomTeam}
              onFieldChange={handleFieldChange}
            />
          </div>
        </div>
      ) : null}

      {statsDetail ? (
        <div
          className="modal-backdrop stats-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={statsDetail.title}
          onClick={closeStatsDetail}
        >
          <div className="stats-detail-shell" onClick={(event) => event.stopPropagation()}>
            <div className="stats-detail-header">
              <div>
                <p className="eyebrow">Estadísticas</p>
                <h3>{statsDetail.title}</h3>
                <p>
                  {statsDetail.entries
                    ? `${statsDetail.entries.length} entradas`
                    : `${statsDetail.shirts?.length ?? 0} camisetas`}
                </p>
              </div>
              <button
                type="button"
                className="stats-modal-close"
                onClick={closeStatsDetail}
                aria-label="Cerrar estadística"
              >
                x
              </button>
            </div>

            <div className="stats-detail-content">
              {statsDetail.entries ? (
                statsDetail.entries.length > 0 ? (
                  <div className="stats-detail-ranking-list">
                    {statsDetail.entries.map((entry, index) => (
                      <button
                        key={`${statsDetail.key}-${entry.key}`}
                        type="button"
                        className="stats-detail-ranking-row"
                        onClick={() => handleStatsItemOpen(statsDetail.key, entry)}
                      >
                        <div className="stats-detail-ranking-main">
                          <span className="stats-ranking-position">{index + 1}</span>
                          <span className="stats-ranking-name">
                            {entry.name}
                            <span className="stats-presence-icons">{getRankingPresenceIcons(entry)}</span>
                          </span>
                          <span className="stats-ranking-count">{entry.total}</span>
                        </div>
                        {renderStatsDistribution(entry)}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400">Sin datos</p>
                )
              ) : statsDetail.shirts && statsDetail.shirts.length > 0 ? (
                <div className="stats-shirt-list">
                  {statsDetail.shirts.map((shirt) => (
                    <button
                      key={shirt.id}
                      type="button"
                      onClick={() => {
                        setStatsDetailKey(null);
                        setIsSortOpen(false);
                        setViewingShirtId(shirt.id);
                      }}
                    >
                      <span>{shirt.team}</span>
                      <small>
                        {[shirt.season, shirt.player || shirt.number ? `${shirt.player} ${shirt.number}`.trim() : "", shirt.status]
                          .filter(Boolean)
                          .join(" · ")}
                      </small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400">Sin camisetas</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedStatsItem ? (
        <div
          className="modal-backdrop stats-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={getStatsItemTitle(selectedStatsItem.key, selectedStatsItem.entry.name)}
          onClick={closeSelectedStatsItem}
        >
          <div className="stats-item-shell" onClick={(event) => event.stopPropagation()}>
            <div className="stats-detail-header">
              <div className="min-w-0">
                <p className="eyebrow">Detalle</p>
                <h3>{getStatsItemTitle(selectedStatsItem.key, selectedStatsItem.entry.name)}</h3>
                <p>
                  Total: {selectedStatsItem.entry.total} · Colección: {selectedStatsItem.entry.collection} · Wishlist: {selectedStatsItem.entry.wishlist}
                </p>
              </div>
              <button
                type="button"
                className="stats-modal-close"
                onClick={closeSelectedStatsItem}
                aria-label="Cerrar detalle"
              >
                x
              </button>
            </div>

            <div className="stats-item-summary">
              <span className="stats-breakdown-item">Total: {selectedStatsItem.entry.total}</span>
              <span className="stats-breakdown-item is-collection">Colección: {selectedStatsItem.entry.collection}</span>
              <span className="stats-breakdown-item is-wishlist">Wishlist: {selectedStatsItem.entry.wishlist}</span>
              <span className="stats-presence-icons">{getRankingPresenceIcons(selectedStatsItem.entry)}</span>
            </div>

            <div className="stats-item-shirt-list">
              {selectedStatsShirts.length > 0 ? (
                selectedStatsShirts.map((shirt) => (
                  <button
                    key={shirt.id}
                    type="button"
                    className="stats-item-shirt-row"
                    onClick={() => {
                      closeSelectedStatsItem();
                      closeStatsDetail();
                      setIsSortOpen(false);
                      setViewingShirtId(shirt.id);
                    }}
                  >
                    <img
                      src={getShirtImageUrl(shirt)}
                      alt={`${shirt.team} ${shirt.season}`}
                      loading="lazy"
                    />
                    <span className="stats-item-shirt-copy">
                      <span className="stats-item-shirt-title">{shirt.team}</span>
                      <span className="stats-item-shirt-meta">
                        <span>{shirt.player || "Sin jugador"}</span>
                        <span>{shirt.number ? `#${shirt.number}` : "Sin dorsal"}</span>
                        <span>{shirt.season}</span>
                      </span>
                    </span>
                    <span className={`stats-item-status ${shirt.status === "wishlist" ? "is-wishlist" : ""}`}>
                      {shirt.status === "wishlist" ? "Wishlist" : "Colección"}
                    </span>
                  </button>
                ))
              ) : (
                <p className="text-slate-400">No hay camisetas asociadas.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {viewingShirt && (
        <ImageGalleryModal
          shirt={viewingShirt}
          isOpen={!!viewingShirtId}
          onClose={() => setViewingShirtId(null)}
          onEdit={handleEdit}
          onDelete={handleDeleteRequested}
          readOnly={readOnly}
        />
      )}

      {!readOnly && deleteConfirmation ? (
        <div
          className="fixed inset-0 z-[160] flex items-center justify-center bg-slate-950/75 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación"
          onClick={handleCancelDelete}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/90 to-slate-900 opacity-90"></div>
          <div
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/85 p-7 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition duration-300 ease-out hover:-translate-y-1"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-4 rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm shadow-slate-950/20 backdrop-blur-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-3xl bg-red-500/15 text-red-300 ring-1 ring-red-400/20">
                <span className="text-xl" aria-hidden="true">!</span>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Acción destructiva</p>
                <h3 className="text-lg font-semibold text-white">Eliminar camiseta</h3>
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <p className="text-2xl font-semibold leading-tight text-white">¿Seguro que quieres eliminar {deleteConfirmation.type === "multiple" ? `${deleteConfirmation.count} camisetas` : "esta camiseta"}?</p>
              <p className="text-sm leading-6 text-slate-400">
                Esta acción no se puede deshacer. Las imágenes vinculadas también se eliminarán permanentemente.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={handleCancelDelete}
                className="group rounded-3xl border border-slate-700/80 bg-slate-900/80 px-5 py-3 text-sm font-semibold text-slate-200 shadow-sm shadow-slate-950/20 transition duration-200 hover:-translate-y-0.5 hover:border-slate-500 hover:bg-slate-900"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-3xl bg-gradient-to-r from-red-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-500/20 transition duration-200 hover:-translate-y-0.5 hover:brightness-110"
              >
                Eliminar ahora
              </button>
            </div>

            <div className="mt-6 rounded-3xl border border-slate-700/60 bg-slate-900/70 px-4 py-4 text-sm text-slate-400 shadow-inner shadow-slate-950/20">
              <p className="font-medium text-slate-200">Consejo:</p>
              <p className="mt-1 leading-6">Si prefieres conservar la camiseta, selecciona <span className="font-semibold text-slate-100">Cancelar</span> y revisa tu colección.</p>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
