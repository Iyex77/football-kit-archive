export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function resolveTheme(pref: ThemePreference): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(pref: ThemePreference) {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setTheme(pref: ThemePreference) {
  localStorage.setItem(STORAGE_KEY, pref);
  applyTheme(pref);
}
