export const THEME_STORAGE_KEY = "oppo-line-oa-theme";
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

type ThemeStorage = Pick<Storage, "getItem" | "setItem">;

export function isThemePreference(value: string | null): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

export function loadTheme(storage: ThemeStorage): ThemePreference {
  const savedTheme = storage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(savedTheme) ? savedTheme : "system";
}

export function saveTheme(storage: ThemeStorage, theme: ThemePreference) {
  storage.setItem(THEME_STORAGE_KEY, theme);
}

export function resolveTheme(
  theme: ThemePreference,
  systemDark: boolean,
): ResolvedTheme {
  return theme === "system" ? (systemDark ? "dark" : "light") : theme;
}

/**
 * The preference one click of the top-bar toggle sets: the opposite of the
 * theme on screen. With "system" that is the opposite of what the system
 * currently resolves to, and the choice becomes explicit.
 */
export function toggledThemePreference(shown: ResolvedTheme): ThemePreference {
  return shown === "dark" ? "light" : "dark";
}

type ThemeRoot = {
  classList: Pick<DOMTokenList, "remove">;
  dataset: DOMStringMap;
  style: Pick<CSSStyleDeclaration, "colorScheme">;
};

export function applyThemeToRoot(root: ThemeRoot, theme: ResolvedTheme) {
  root.classList.remove("dark", "light");
  delete root.dataset.theme;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
