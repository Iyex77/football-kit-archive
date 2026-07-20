import { catalog } from "./collection-data";
import type {
  Shirt,
  ShirtCategory,
  ShirtFilters,
  ShirtFormState,
  Sport,
  TeamOption,
} from "./types";

// Pure, side-effect-free logic used by ShirtCollectionApp: filtering,
// sorting, stats aggregation, and catalog/team-option lookups. Nothing here
// reads component state directly - everything is passed in as an argument -
// so it's reusable and testable independent of the component tree.

export type SortField = "added" | "team" | "player" | "number" | "season";
export type SortDirection = "asc" | "desc";

export type SortBy = {
  field: SortField;
  direction: SortDirection;
};

export type StatsDetailKey =
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

export type StatsRankingEntry = {
  key: string;
  name: string;
  total: number;
  collection: number;
  wishlist: number;
  count: number;
};

export const unique = (values: string[]) =>
  Array.from(new Set(values.map((value) => value.trim()).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );

export const getSportFilterFromSearch = (search: string): "all" | Sport => {
  const sport = new URLSearchParams(search).get("sport");
  return sport === "football" || sport === "basketball" ? sport : "all";
};

export const defaultSortDirectionByField: Record<SortField, SortDirection> = {
  added: "desc",
  team: "asc",
  player: "asc",
  number: "asc",
  season: "desc",
};

export const sortOptions: Array<{ field: SortField; label: string; ascLabel: string; descLabel: string }> = [
  { field: "added", label: "Añadidas", ascLabel: "Antiguas primero", descLabel: "Recientes primero" },
  { field: "team", label: "Equipo", ascLabel: "A-Z", descLabel: "Z-A" },
  { field: "player", label: "Jugador", ascLabel: "A-Z", descLabel: "Z-A" },
  { field: "number", label: "Dorsal", ascLabel: "0-99", descLabel: "99-0" },
  { field: "season", label: "Temporada", ascLabel: "Antigua primero", descLabel: "Reciente primero" },
];

export const compactLabel = (value: string) => value.trim().replace(/\s+/g, " ");

export const normalizeStatsKey = (value: string) =>
  compactLabel(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

export const getLeagueStatsValue = (value: string) => {
  const label = compactLabel(value);
  const key = normalizeStatsKey(label);
  if (!key) return "";
  if (key === "laligaeasports") return "LaLiga EA Sports";
  if (key === "laligahypermotion") return "LaLiga Hypermotion";
  return label;
};

export const getPlayerStatsValue = (value: string) => {
  const label = compactLabel(value);
  const key = normalizeStatsKey(label);
  if (!key || key === "sinnombre" || key === "sinjugador") return "";
  return label;
};

export const getKitTypeStatsValue = (value: string) => {
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

export const getSizeStatsValue = (value: string) => {
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

export const getStatsValue = (shirt: Shirt, key: StatsDetailKey) => {
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

export const countBy = (shirts: Shirt[], key: StatsDetailKey) =>
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

export function createTeamOptions() {
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

export const allTeamOptions = createTeamOptions();

export function createTeamOptionsFromShirts(shirts: Shirt[]) {
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

export function mergeTeamOptions(options: TeamOption[]) {
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

export function getTypeOptions(sport: string) {
  if (!sport || !(sport in catalog)) {
    return [] as ShirtCategory[];
  }

  return Object.keys(catalog[sport as Sport]) as ShirtCategory[];
}

export function getCountryOptions(sport: string, category: string) {
  if (!sport || !category || !(sport in catalog)) {
    return [];
  }

  const sportCatalog = catalog[sport as Sport];
  return category in sportCatalog ? Object.keys(sportCatalog[category as ShirtCategory]) : [];
}

export function getLeagueOptions(sport: string, category: string, country: string) {
  if (!sport || !category || !country || !(sport in catalog)) {
    return [];
  }

  const sportCatalog = catalog[sport as Sport];
  const categoryCatalog = category in sportCatalog ? sportCatalog[category as ShirtCategory] : undefined;
  return country && categoryCatalog && country in categoryCatalog ? Object.keys(categoryCatalog[country]) : [];
}

export function getTeamOptions(sport: string, category: string, country: string, league: string) {
  if (!sport || !category || !country || !league || !(sport in catalog)) {
    return [];
  }

  const sportCatalog = catalog[sport as Sport];
  const categoryCatalog = category in sportCatalog ? sportCatalog[category as ShirtCategory] : undefined;
  const countryCatalog = country && categoryCatalog && country in categoryCatalog ? categoryCatalog[country] : undefined;
  return league && countryCatalog && league in countryCatalog ? countryCatalog[league] : [];
}

export function formFromShirt(shirt: Shirt): ShirtFormState {
  const teams = getTeamOptions(shirt.sport, shirt.category, shirt.country, shirt.league);
  const team = teams.includes(shirt.team) ? shirt.team : "custom";

  return {
    ...shirt,
    team,
    customTeam: team === "custom" ? shirt.team : "",
  };
}

export function getFilterOptions(shirts: Shirt[], filters: ShirtFilters) {
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

export function matchesFilters(shirt: Shirt, filters: ShirtFilters) {
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
