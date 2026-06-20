import type { ShirtCategory, ShirtFormState, Sport, TeamOption } from "./types";

export type SmartAutofillResult = {
  teamOption?: TeamOption;
  customTeam?: string;
  sport?: Sport;
  category?: ShirtCategory;
  country?: string;
  league?: string;
  season?: string;
  player?: string;
  number?: string;
  kitType?: string;
  size?: string;
};

type TextMatch = {
  value: string;
  raw: string;
};

type LeagueMatch = {
  phrase: string;
  league: string;
  sport?: Sport;
  category?: ShirtCategory;
  country?: string;
};

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

const normalizeInput = (value: string) =>
  value
    .replace(/\r?\n+/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const normalizeCompact = (value: string) => normalizeSearch(value).replace(/\s+/g, "");

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const stripRawText = (source: string, raw: string) =>
  source.replace(new RegExp(`(^|\\s)${escapeRegExp(raw)}(?=\\s|$)`, "i"), " ");

const stripNormalizedPhrase = (source: string, phrase: string) => {
  const phraseWords = normalizeSearch(phrase).split(" ").filter(Boolean);
  const sourceWords = Array.from(source.matchAll(/\S+/g));

  if (phraseWords.length === 0) return source;

  for (let index = 0; index <= sourceWords.length - phraseWords.length; index += 1) {
    const candidate = sourceWords.slice(index, index + phraseWords.length);
    const isMatch = candidate.every((match, wordIndex) => normalizeSearch(match[0]) === phraseWords[wordIndex]);

    if (isMatch) {
      const start = candidate[0].index ?? 0;
      const lastWord = candidate[candidate.length - 1];
      const end = (lastWord.index ?? 0) + lastWord[0].length;
      return `${source.slice(0, start)} ${source.slice(end)}`;
    }
  }

  return source;
};

const stripAllNormalizedPhrases = (source: string, phrases: string[]) =>
  phrases.reduce((current, phrase) => stripNormalizedPhrase(current, phrase), source);

const stopWords = new Set(["de", "del", "la", "el", "cf", "fc", "club"]);

const teamAliases: Record<string, string[]> = {
  "Atlético de Madrid": ["Atletico Madrid", "Atlético Madrid", "Atleti"],
};

const countryAliases: Record<string, string> = {
  argentina: "Argentina",
  belgium: "Bélgica",
  belgica: "Bélgica",
  brasil: "Brasil",
  brazil: "Brasil",
  croacia: "Croacia",
  croatia: "Croacia",
  eeuu: "Estados Unidos",
  england: "Inglaterra",
  escocia: "Escocia",
  espana: "España",
  españa: "España",
  "estados unidos": "Estados Unidos",
  france: "Francia",
  francia: "Francia",
  germany: "Alemania",
  alemania: "Alemania",
  inglaterra: "Inglaterra",
  italy: "Italia",
  italia: "Italia",
  japon: "Japón",
  japan: "Japón",
  marruecos: "Marruecos",
  morocco: "Marruecos",
  mexico: "México",
  méxico: "México",
  portugal: "Portugal",
  "paises bajos": "Países Bajos",
  "países bajos": "Países Bajos",
  netherlands: "Países Bajos",
  "saudi arabia": "Arabia Saudí",
  "arabia saudi": "Arabia Saudí",
  "arabia saudí": "Arabia Saudí",
  scotland: "Escocia",
  spain: "España",
  turkey: "Turquía",
  turquia: "Turquía",
  turquía: "Turquía",
  uruguay: "Uruguay",
  usa: "Estados Unidos",
  us: "Estados Unidos",
  "united states": "Estados Unidos",
};

const externalLeagues: LeagueMatch[] = [
  { phrase: "Premier League", league: "Premier League", country: "Inglaterra", sport: "football", category: "club" },
  { phrase: "Championship", league: "Championship", country: "Inglaterra", sport: "football", category: "club" },
  { phrase: "LaLiga", league: "LaLiga EA Sports", country: "España", sport: "football", category: "club" },
  { phrase: "La Liga", league: "LaLiga EA Sports", country: "España", sport: "football", category: "club" },
  { phrase: "Serie A", league: "Serie A", country: "Italia", sport: "football", category: "club" },
  { phrase: "Serie B", league: "Serie B", country: "Italia", sport: "football", category: "club" },
  { phrase: "Bundesliga", league: "Bundesliga", country: "Alemania", sport: "football", category: "club" },
  { phrase: "2. Bundesliga", league: "2. Bundesliga", country: "Alemania", sport: "football", category: "club" },
  { phrase: "Ligue 1", league: "Ligue 1", country: "Francia", sport: "football", category: "club" },
  { phrase: "Ligue 2", league: "Ligue 2", country: "Francia", sport: "football", category: "club" },
  { phrase: "MLS", league: "MLS", country: "Estados Unidos", sport: "football", category: "club" },
  { phrase: "Eredivisie", league: "Eredivisie", country: "Países Bajos", sport: "football", category: "club" },
  { phrase: "Liga Portugal", league: "Liga Portugal", country: "Portugal", sport: "football", category: "club" },
  { phrase: "Brasileirão", league: "Brasileirão", country: "Brasil", sport: "football", category: "club" },
  { phrase: "Brasileirao", league: "Brasileirão", country: "Brasil", sport: "football", category: "club" },
  {
    phrase: "Liga Profesional Argentina",
    league: "Liga Profesional Argentina",
    country: "Argentina",
    sport: "football",
    category: "club",
  },
  {
    phrase: "Liga Profesional",
    league: "Liga Profesional Argentina",
    country: "Argentina",
    sport: "football",
    category: "club",
  },
  { phrase: "Saudi Pro League", league: "Saudi Pro League", country: "Arabia Saudí", sport: "football", category: "club" },
  { phrase: "Liga MX", league: "Liga MX", country: "México", sport: "football", category: "club" },
  {
    phrase: "Scottish Premiership",
    league: "Scottish Premiership",
    country: "Escocia",
    sport: "football",
    category: "club",
  },
  { phrase: "Süper Lig", league: "Süper Lig", country: "Turquía", sport: "football", category: "club" },
  { phrase: "Super Lig", league: "Süper Lig", country: "Turquía", sport: "football", category: "club" },
  { phrase: "J1 League", league: "J1 League", country: "Japón", sport: "football", category: "club" },
];

const leagueAliases: Record<string, string[]> = {
  "LaLiga EA Sports": ["La Liga", "Liga", "LaLiga", "LaLiga EA Sports"],
  "LaLiga Hypermotion": ["LaLiga Hypermotion", "Segunda Division", "Segunda División"],
};

const kitTypeAliases: Record<string, string> = {
  "home kit": "Local",
  "local kit": "Local",
  home: "Local",
  local: "Local",
  primera: "Local",
  "away kit": "Visitante",
  "visitante kit": "Visitante",
  away: "Visitante",
  visitante: "Visitante",
  segunda: "Visitante",
  "third kit": "Tercera",
  "tercera kit": "Tercera",
  third: "Tercera",
  tercera: "Tercera",
  "fourth kit": "Cuarta",
  "cuarta kit": "Cuarta",
  fourth: "Cuarta",
  cuarta: "Cuarta",
  "goalkeeper kit": "Portero",
  "gk kit": "Portero",
  goalkeeper: "Portero",
  keeper: "Portero",
  portero: "Portero",
  gk: "Portero",
  "special kit": "Especial",
  special: "Especial",
  especial: "Especial",
  alternativa: "Especial",
};

const kitWordsToDiscard = ["kit", "camiseta", "shirt", "equipacion", "equipación"];

const sizeAliases: Record<string, string> = {
  xs: "XS",
  s: "S",
  m: "M",
  l: "L",
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

const cleanName = (value: string) =>
  stripAllNormalizedPhrases(value, kitWordsToDiscard)
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,.;:|/-]+|[,.;:|/-]+$/g, "")
    .trim();

const getTeamPhrases = (option: TeamOption) => {
  const base = [option.team, ...(teamAliases[option.team] ?? [])];
  const withoutStopWords = normalizeSearch(option.team)
    .split(" ")
    .filter((word) => !stopWords.has(word))
    .join(" ");

  return Array.from(new Set([...base, withoutStopWords].filter((phrase) => phrase.trim().length > 0)));
};

const findTeamOption = (text: string, options: TeamOption[]) => {
  const normalizedText = ` ${normalizeSearch(text)} `;
  const compactText = normalizeCompact(text);

  return options
    .flatMap((option) =>
      getTeamPhrases(option).map((phrase) => ({
        option,
        phrase,
        normalizedPhrase: normalizeSearch(phrase),
        compactPhrase: normalizeCompact(phrase),
      })),
    )
    .filter(({ normalizedPhrase, compactPhrase }) => {
      return normalizedText.includes(` ${normalizedPhrase} `) || compactText.includes(compactPhrase);
    })
    .sort((left, right) => right.normalizedPhrase.length - left.normalizedPhrase.length)[0];
};

const findLeague = (text: string, options: TeamOption[]): LeagueMatch | undefined => {
  const catalogLeagues = Array.from(new Set(options.map((option) => option.league)));
  const catalogCandidates = catalogLeagues.flatMap((league) =>
    [league, ...(leagueAliases[league] ?? [])].map((phrase) => ({
      league,
      phrase,
      normalizedPhrase: normalizeSearch(phrase),
    })),
  );
  const externalCandidates = externalLeagues.map((league) => ({
    ...league,
    normalizedPhrase: normalizeSearch(league.phrase),
  }));
  const normalizedText = ` ${normalizeSearch(text)} `;

  return [...catalogCandidates, ...externalCandidates]
    .filter(({ normalizedPhrase }) => normalizedText.includes(` ${normalizedPhrase} `))
    .sort((left, right) => right.normalizedPhrase.length - left.normalizedPhrase.length)[0];
};

const findCountry = (text: string) => {
  const normalizedText = ` ${normalizeSearch(text)} `;

  return Object.entries(countryAliases)
    .map(([phrase, country]) => ({ phrase, country, normalizedPhrase: normalizeSearch(phrase) }))
    .filter(({ normalizedPhrase }) => normalizedText.includes(` ${normalizedPhrase} `))
    .sort((left, right) => right.normalizedPhrase.length - left.normalizedPhrase.length)[0];
};

const findSeason = (text: string): TextMatch | undefined => {
  const seasonMatch = text.match(/\b((?:19|20)\d{2})\s*[/-]\s*(\d{2})\b|\b((?:19|20)\d{2})\b/);
  if (!seasonMatch) return undefined;

  if (seasonMatch[1] && seasonMatch[2]) {
    return {
      raw: seasonMatch[0],
      value: `${seasonMatch[1]}/${seasonMatch[2]}`,
    };
  }

  return {
    raw: seasonMatch[0],
    value: seasonMatch[0],
  };
};

const findSize = (text: string): TextMatch | undefined => {
  const sizeMatch = text.match(/\b(?:[2-5]XL|XXL|XL|XS|S|M|L)\b/i);
  if (!sizeMatch) return undefined;
  const raw = sizeMatch[0];
  return {
    raw,
    value: sizeAliases[raw.toLowerCase()],
  };
};

const findKitType = (text: string): TextMatch | undefined => {
  const normalizedText = ` ${normalizeSearch(text)} `;
  const candidates = Object.entries(kitTypeAliases)
    .map(([phrase, value]) => ({ raw: phrase, value, normalizedPhrase: normalizeSearch(phrase) }))
    .filter(({ normalizedPhrase }) => normalizedText.includes(` ${normalizedPhrase} `))
    .sort((left, right) => right.normalizedPhrase.length - left.normalizedPhrase.length);

  return candidates[0];
};

const stripKnownNonPlayerEntities = (source: string, options: TeamOption[]) => {
  let remaining = source;
  let removedEntity = true;

  while (removedEntity) {
    removedEntity = false;

    const leagueMatch = findLeague(remaining, options);
    if (leagueMatch) {
      const nextRemaining = stripNormalizedPhrase(remaining, leagueMatch.phrase);
      if (nextRemaining !== remaining) {
        remaining = nextRemaining;
        removedEntity = true;
      }
    }

    const countryMatch = findCountry(remaining);
    if (countryMatch) {
      const nextRemaining = stripNormalizedPhrase(remaining, countryMatch.phrase);
      if (nextRemaining !== remaining) {
        remaining = nextRemaining;
        removedEntity = true;
      }
    }

    const season = findSeason(remaining);
    if (season) {
      const nextRemaining = stripRawText(remaining, season.raw);
      if (nextRemaining !== remaining) {
        remaining = nextRemaining;
        removedEntity = true;
      }
    }

    const kitType = findKitType(remaining);
    if (kitType) {
      const nextRemaining = stripAllNormalizedPhrases(
        stripNormalizedPhrase(remaining, kitType.raw),
        kitWordsToDiscard,
      );
      if (nextRemaining !== remaining) {
        remaining = nextRemaining;
        removedEntity = true;
      }
    }
  }

  return remaining;
};

const isKnownNonPlayerEntity = (value: string, options: TeamOption[]) => {
  const cleaned = cleanName(value);
  if (!cleaned) return false;

  return Boolean(
    findCountry(cleaned) ||
      findLeague(cleaned, options) ||
      findSeason(cleaned) ||
      findKitType(cleaned) ||
      normalizeSearch(cleaned) === "kit",
  );
};

const findNumber = (text: string): TextMatch | undefined => {
  const hashMatch = text.match(/#\s*(\d{1,3})\b/);
  if (hashMatch) {
    return {
      raw: hashMatch[0],
      value: hashMatch[1],
    };
  }

  const dorsalMatch = text.match(/\b(?:dorsal|numero|número|number|no)\s+(\d{1,3})\b/i);
  if (dorsalMatch) {
    return {
      raw: dorsalMatch[0],
      value: dorsalMatch[1],
    };
  }

  const isolatedMatch = text.match(/(?:^|\s)(\d{1,3})(?=\s|$)/);
  if (isolatedMatch) {
    return {
      raw: isolatedMatch[1],
      value: isolatedMatch[1],
    };
  }

  return undefined;
};

const compactPlayer = (text: string, options: TeamOption[]) => {
  const value = cleanName(text)
    .replace(/#\s*\d{1,3}\b/g, " ")
    .replace(/\b(?:dorsal|numero|número|number|no)\s+\d{1,3}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!value || isKnownNonPlayerEntity(value, options) || normalizeSearch(value).split(" ").length > 3) {
    return "";
  }

  return value;
};

const inferCustomTeam = (text: string) => {
  const value = cleanName(text);
  if (!value) return "";

  const words = normalizeSearch(value).split(" ").filter(Boolean);
  if (words.length === 0 || words.length > 5) return "";

  return value;
};

export function parseSmartAutofillText(text: string, teamOptions: TeamOption[]): SmartAutofillResult {
  const result: SmartAutofillResult = {};
  let remaining = normalizeInput(text);

  const leagueMatch = findLeague(remaining, teamOptions);
  if (leagueMatch) {
    result.league = leagueMatch.league;
    result.sport = leagueMatch.sport;
    result.category = leagueMatch.category;
    result.country = leagueMatch.country;
    remaining = stripNormalizedPhrase(remaining, leagueMatch.phrase);
  }

  const countryMatch = findCountry(remaining);
  if (countryMatch) {
    result.country = result.country ?? countryMatch.country;
    remaining = stripNormalizedPhrase(remaining, countryMatch.phrase);
  }

  const teamMatch = findTeamOption(remaining, teamOptions);
  if (teamMatch) {
    result.teamOption = teamMatch.option;
    remaining = stripNormalizedPhrase(remaining, teamMatch.phrase);
  }

  const season = findSeason(remaining);
  if (season) {
    result.season = season.value;
    remaining = stripRawText(remaining, season.raw);
  }

  const size = findSize(remaining);
  if (size) {
    result.size = size.value;
    remaining = stripRawText(remaining, size.raw);
  }

  const kitType = findKitType(remaining);
  if (kitType) {
    result.kitType = kitType.value;
    remaining = stripNormalizedPhrase(remaining, kitType.raw);
    remaining = stripAllNormalizedPhrases(remaining, kitWordsToDiscard);
  }

  const number = findNumber(remaining);
  if (number) {
    result.number = number.value;
    remaining = stripRawText(remaining, number.raw);
  }

  remaining = stripKnownNonPlayerEntities(remaining, teamOptions);

  if (!result.teamOption && (result.league || (result.country && result.sport === "football"))) {
    const customTeam = inferCustomTeam(remaining);
    if (customTeam) {
      result.customTeam = customTeam;
      result.sport = result.sport ?? "football";
      result.category = result.category ?? "club";
      remaining = stripNormalizedPhrase(remaining, customTeam);
    }
  }

  remaining = stripKnownNonPlayerEntities(remaining, teamOptions);

  const player = compactPlayer(remaining, teamOptions);
  if (player) {
    result.player = player;
  }

  return result;
}

export function createSmartAutofillPatch(
  form: ShirtFormState,
  parsed: SmartAutofillResult,
): Partial<ShirtFormState> {
  const patch: Partial<ShirtFormState> = {};
  const setIfEmpty = <K extends keyof ShirtFormState>(field: K, value: ShirtFormState[K] | undefined) => {
    if (value && String(form[field] ?? "").trim() === "") {
      patch[field] = value;
    }
  };

  if (parsed.teamOption) {
    setIfEmpty("sport", parsed.teamOption.sport);
    setIfEmpty("category", parsed.teamOption.category);
    setIfEmpty("country", parsed.teamOption.country);
    setIfEmpty("league", parsed.teamOption.league);
    setIfEmpty("team", parsed.teamOption.team);
  } else {
    setIfEmpty("sport", parsed.sport);
    setIfEmpty("category", parsed.category);
    setIfEmpty("country", parsed.country);
    setIfEmpty("league", parsed.league);

    if (parsed.customTeam) {
      setIfEmpty("team", "custom");
      setIfEmpty("customTeam", parsed.customTeam);
    }
  }

  setIfEmpty("season", parsed.season);
  setIfEmpty("player", parsed.player);
  setIfEmpty("number", parsed.number);
  setIfEmpty("kitType", parsed.kitType);
  setIfEmpty("size", parsed.size);

  return patch;
}

/*
Manual parser examples:
- USA / MLS / 2024 / Inter Miami / Third Kit -> Estados Unidos, MLS, custom team Inter Miami, 2024, Tercera.
- La Liga / 1999-00 / Atlético Madrid / Away Kit -> LaLiga EA Sports, Atlético de Madrid, 1999/00, Visitante.
- Japan / J1 League / 2022 / Vissel Kobe / Home Kit -> Japón, J1 League, custom team Vissel Kobe, 2022, Local.
- Argentina / Liga Profesional / 2023 / Boca Juniors / Home Kit -> Argentina, Liga Profesional Argentina, custom team Boca Juniors, 2023, Local.
*/
