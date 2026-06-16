"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase-auth";
import {
  catalog,
  defaultForm,
  emptyFilters,
  placeholderImages,
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

type SortBy =
  | "recent"
  | "oldest"
  | "team-asc"
  | "team-desc"
  | "player-asc"
  | "player-desc"
  | "number-asc"
  | "number-desc"
  | "season-desc"
  | "sport"
  | "wishlist-first";

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
  const [shirts, setShirts] = useState<Shirt[]>(initialShirts ?? []);
  const [isLoading, setIsLoading] = useState(!initialShirts);
  const [profile, setProfile] = useState<Profile | null>(publicProfile ?? null);
  const [isViewingOwnPublicProfile, setIsViewingOwnPublicProfile] = useState(false);
  const viewMode = defaultViewMode;
  const [form, setForm] = useState<ShirtFormState>(defaultForm);
  const [filters, setFilters] = useState<ShirtFilters>(emptyFilters);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [viewingShirtId, setViewingShirtId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState<
    | { type: "single"; id: string }
    | { type: "multiple"; count: number }
    | null
  >(null);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const [statsDetailKey, setStatsDetailKey] = useState<StatsDetailKey | null>(null);
  const [selectedStatsItem, setSelectedStatsItem] = useState<SelectedStatsItem | null>(null);
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

  async function loadShirts() {
    if (readOnly) return;
    try {
      const { data, error } = await supabase
        .from("shirts")
        .select("*")
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
      .select("id, username, display_name, is_public, show_collection, show_wishlist, created_at")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile(data as Profile);
    }
  }

  const editingShirt = shirts.find((shirt) => shirt.id === editingId);
  const viewingShirt = shirts.find((shirt) => shirt.id === viewingShirtId);
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
  const getIdTimestamp = (id: string) => {
    const [, timestamp] = id.split("-");
    const value = Number(timestamp);
    return Number.isNaN(value) ? 0 : value;
  };

  const numberValue = (value: string | number | undefined) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
  };

  const sortedShirts = (() => {
    const list = [...filteredShirts];
    switch (sortBy) {
      case "recent":
        return list.sort((a, b) => getIdTimestamp(b.id) - getIdTimestamp(a.id));
      case "oldest":
        return list.sort((a, b) => getIdTimestamp(a.id) - getIdTimestamp(b.id));
      case "team-asc":
        return list.sort((a, b) => a.team.localeCompare(b.team, undefined, { sensitivity: "base" }));
      case "team-desc":
        return list.sort((a, b) => b.team.localeCompare(a.team, undefined, { sensitivity: "base" }));
      case "player-asc":
        return list.sort((a, b) =>
          (a.player || "").localeCompare(b.player || "", undefined, { sensitivity: "base" }),
        );
      case "player-desc":
        return list.sort((a, b) =>
          (b.player || "").localeCompare(a.player || "", undefined, { sensitivity: "base" }),
        );
      case "number-asc":
        return list.sort((a, b) => numberValue(a.number) - numberValue(b.number));
      case "number-desc":
        return list.sort((a, b) => {
          const left = numberValue(a.number);
          const right = numberValue(b.number);
          if (left === Number.NEGATIVE_INFINITY && right === Number.NEGATIVE_INFINITY) return 0;
          if (left === Number.NEGATIVE_INFINITY) return -1;
          if (right === Number.NEGATIVE_INFINITY) return -1;
          return right - left;
        });
      case "season-desc":
        return list.sort((a, b) =>
          (b.season || "").localeCompare(a.season || "", undefined, { sensitivity: "base" }),
        );
      case "sport":
        return list.sort((a, b) => a.sport.localeCompare(b.sport, undefined, { sensitivity: "base" }));
      case "wishlist-first":
        return list.sort((a, b) => (a.status === b.status ? 0 : a.status === "wishlist" ? -1 : 1));
      default:
        return list;
    }
  })();
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

  const isSelectModeActive = !readOnly && selectedIds.length > 0;

  const openCreateForm = () => {
    if (readOnly) return;
    setEditingId(null);
    setForm(defaultForm);
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
    const normalizedValue = value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase();
    const matches = teamOptions.filter((option) =>
      option.team
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]/g, "")
        .toLowerCase()
        .includes(normalizedValue),
    );

    if (normalizedValue.length >= 3 && matches.length === 1) {
      handleTeamSelect(matches[0]);
      return;
    }

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

  const handleDelete = async (id: string) => {
    const shirt = shirts.find((s) => s.id === id);

    if (!shirt) return;

    // BORRAR IMAGENES STORAGE
    if (shirt.images?.length) {

      const filesToDelete = shirt.images
        .map((img) => {

          console.log("RAW URL:", img.url);

          if (!img.url.includes("/storage/v1/object/public/shirts/")) {
            return null;
          }

          return img.url.split(
            "/storage/v1/object/public/shirts/"
          )[1];

        })
        .filter((file): file is string => Boolean(file))

      if (filesToDelete.length) {

        console.log("SHIRT IMAGES:", shirt.images);

        console.log(
          "FILES TO DELETE:",
          filesToDelete
        );
      
        const result =
          await supabase.storage
            .from("shirts")
            .remove(filesToDelete);
      
        console.log(
          "STORAGE DELETE RESULT:",
          result
        );
      }
    }

    // BORRAR ROW BD
    const { error } = await supabase
      .from("shirts")
      .delete()
      .eq("id", id);

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

  const handleToggleWishlist = (id: string) => {
    if (readOnly) return;
    setShirts((current) =>
      current.map((shirt) =>
        shirt.id === id
          ? {
              ...shirt,
              status: shirt.status === "wishlist" ? "collection" : "wishlist",
            }
          : shirt,
      ),
    );
  };

  const handleCardClick = (id: string) => {
    if (!readOnly && isSelectModeActive) {
      toggleSelect(id);
      return;
    }
    setViewingShirtId(id);
  };

  const handleDeleteMultiple = () => {
    if (selectedIds.length === 0) return;
    setShirts((current) => current.filter((s) => !selectedIds.includes(s.id)));
    clearSelection();
  };

  const handleMoveToCollection = () => {
    if (selectedIds.length === 0) return;
    setShirts((current) => current.map((s) => (selectedIds.includes(s.id) ? { ...s, status: "collection" } : s)));
    clearSelection();
  };

  const handleFilterChange = <K extends keyof ShirtFilters>(field: K, value: ShirtFilters[K]) => {
    setFilters((current) => {
      return { ...current, [field]: value };
    });
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

  const getStatsItemTitle = (key: StatsDetailKey, name: string) => {
    if (key === "numbers") return `Dorsal #${name}`;
    return name;
  };

  const getShirtImageUrl = (shirt: Shirt) => {
    const mainImage = shirt.images.find((img) => img.id === shirt.mainImageId) || shirt.images[0];
    return mainImage?.url || placeholderImages[shirt.sport] || placeholderImages.default;
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

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#142f2d_0,#090d13_36rem,#05070b_100%)] px-4 py-7 text-slate-100 sm:px-6 lg:px-10">
      {!readOnly && onLogout ? <AppDrawer profile={profile} onLogout={onLogout} /> : null}
      {isLoading ? (
        <div className="mx-auto max-w-[1560px] space-y-8">
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
        <div className="mx-auto max-w-[1560px] space-y-8">
          {isViewingOwnPublicProfile ? (
            <div className="public-owner-banner">
              <span>Estás viendo tu vitrina pública</span>
              <Link href="/">← Volver a mi colección</Link>
            </div>
          ) : null}

          <header className="hero-panel flex-col gap-6 items-start">
            <div className="w-full">
              <p className="eyebrow">{readOnly ? "Vitrina pública" : "Vitrina privada"}</p>
              <h1 className="max-w-full break-words text-4xl sm:text-5xl md:text-5xl lg:text-5xl font-semibold tracking-tight">
                {pageTitle}
              </h1>
              {readOnly && profile?.username ? (
                <p>@{profile.username}</p>
              ) : null}
            </div>

            <div className="flex w-full flex-wrap items-center justify-between gap-4">
              <div className="hero-stats" aria-label="Resumen de la colección">
                <span>{stats.totalShirts} piezas</span>
                <span>{stats.collectionCount} en colección</span>
                <span>{stats.wishlistCount} wishlist</span>
              </div>
            </div>
          </header>

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
                  {renderTopCard("teams", "Club mas repetido", stats.topTeam)}
                  {renderTopCard("leagues", "Liga mas repetida", stats.topLeague)}
                  {renderTopCard("seasons", "Temporada mas repetida", stats.topSeason)}
                  {renderTopCard("players", "Jugador mas repetido", stats.topPlayer)}
                  {renderTopCard("numbers", "Dorsal mas repetido", stats.topNumber)}
                  {renderTopCard("countries", "Pais mas repetido", stats.topCountry)}
                  {renderTopCard("sizes", "Talla mas repetida", stats.topSize)}
                  {renderTopCard("kitTypes", "Equipacion mas repetida", stats.topKitType)}
                </div>
              </section>

            </>
          ) : (
            <section className="space-y-7">
              <FiltersBar
                filters={filters}
                leagues={filterOptions.leagues}
                countries={filterOptions.countries}
                onFilterChange={handleFilterChange}
                onReset={() => setFilters(emptyFilters)}
                showStatusFilter={readOnly || viewMode === "all"}
              />

              <div className="collection-heading">
                <div>
                  <p className="eyebrow">
                    {viewMode === "all" ? "Todas las camisetas" : viewMode === "collection" ? "Colección" : "Wishlist"}
                  </p>
                  <h2>{filteredShirts.length} camisetas visibles</h2>
                </div>
              </div>

              {sortedShirts.length > 0 ? (
                <div className="collection-grid">
                  {sortedShirts.map((shirt) => (
                    <ShirtCard
                      key={shirt.id}
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
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  {hasNoPublicSections ? (
                    <>
                      <h3>Este usuario no comparte ninguna sección de su colección.</h3>
                      <p>El perfil público está activo, pero la colección y la wishlist no están visibles.</p>
                    </>
                  ) : (
                    <>
                      <h3>No hay camisetas con esos filtros</h3>
                      <p>
                        {readOnly
                          ? "Ajusta la búsqueda o cambia los filtros de la vitrina."
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

      <div className="floating-actions">
        {!readOnly ? (
          <button className="floating-add" type="button" onClick={openCreateForm}>
            + Añadir camiseta
          </button>
        ) : null}

        <div className="sort-control" ref={sortDropdownRef}>
          <button
            type="button"
            className="sort-icon-button"
            aria-haspopup="menu"
            aria-expanded={isSortOpen}
            onClick={() => setIsSortOpen((current) => !current)}
            title="Ordenar por"
          >
            ↑↓
          </button>

          {isSortOpen && (
            <div className="sort-dropdown floating-up" role="menu">
              <button type="button" role="menuitem" onClick={() => { setSortBy("recent"); setIsSortOpen(false); }}>
                Más recientes
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("oldest"); setIsSortOpen(false); }}>
                Más antiguas
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("team-asc"); setIsSortOpen(false); }}>
                Equipo A-Z
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("team-desc"); setIsSortOpen(false); }}>
                Equipo Z-A
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("player-asc"); setIsSortOpen(false); }}>
                Jugador A-Z
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("player-desc"); setIsSortOpen(false); }}>
                Jugador Z-A
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("number-asc"); setIsSortOpen(false); }}>
                Dorsal menor a mayor
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("number-desc"); setIsSortOpen(false); }}>
                Dorsal mayor a menor
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("season-desc"); setIsSortOpen(false); }}>
                Temporada
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("sport"); setIsSortOpen(false); }}>
                Deporte
              </button>
              <button type="button" role="menuitem" onClick={() => { setSortBy("wishlist-first"); setIsSortOpen(false); }}>
                Wishlist primero
              </button>
            </div>
          )}
        </div>

        {(filters.search.trim() !== "" || filters.sport !== "all" || filters.category !== "all" || filters.league !== "all" || filters.country !== "all" || filters.year.trim() !== "" || filters.status !== "all") && (
          <button
            className="floating-reset-button"
            type="button"
            onClick={() => setFilters(emptyFilters)}
            aria-label="Restablecer filtros"
          >
            ×
          </button>
        )}

      </div>

      {!readOnly && isSelectModeActive && (
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
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Formulario camiseta">
          <div className="modal-shell">
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
                aria-label="Cerrar estadistica"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 px-4 py-8 backdrop-blur-sm">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-950/90 to-slate-900 opacity-90"></div>
          <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-[32px] border border-white/10 bg-slate-950/85 p-7 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.9)] backdrop-blur-xl transition duration-300 ease-out hover:-translate-y-1">
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
