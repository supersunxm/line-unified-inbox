"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { useAppLanguage } from "./language";
import { themeControlLabels } from "./theme-i18n";
import {
  applyThemeToRoot,
  loadTheme,
  resolveTheme,
  saveTheme,
  toggledThemePreference,
} from "./theme-logic";
import type { ResolvedTheme, ThemePreference } from "./theme-logic";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyResolvedTheme(theme: ThemePreference, systemDark: boolean) {
  const resolvedTheme = resolveTheme(theme, systemDark);
  applyThemeToRoot(document.documentElement, resolvedTheme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");

  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const savedTheme = loadTheme(window.localStorage);
    applyResolvedTheme(savedTheme, media.matches);
    const timer = window.setTimeout(() => {
      setThemeState(savedTheme);
    }, 0);
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const currentTheme = loadTheme(window.localStorage);
      if (currentTheme === "system") applyResolvedTheme(currentTheme, event.matches);
    };

    media.addEventListener("change", handleSystemThemeChange);
    return () => {
      window.clearTimeout(timer);
      media.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  const setTheme = (nextTheme: ThemePreference) => {
    saveTheme(window.localStorage, nextTheme);
    applyResolvedTheme(
      nextTheme,
      window.matchMedia(DARK_MEDIA_QUERY).matches,
    );
    setThemeState(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

function subscribeToShownTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

function readShownTheme(): ResolvedTheme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function readServerTheme(): ResolvedTheme {
  return "light";
}

/**
 * The theme on screen (read from <html data-theme>, so it follows "system"
 * changes too) and a one-click switch to the other one. It saves through the
 * same setTheme as ThemeControl.
 */
export function useThemeToggle(): { shown: ResolvedTheme; toggle: () => void } {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useThemeToggle must be used inside ThemeProvider");
  const shown = useSyncExternalStore(subscribeToShownTheme, readShownTheme, readServerTheme);
  return { shown, toggle: () => context.setTheme(toggledThemePreference(shown)) };
}

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeControl must be used inside ThemeProvider");
  const { language } = useAppLanguage();
  const text = themeControlLabels[language];

  const icons: Record<ThemePreference, string> = {
    light: "☀",
    dark: "☾",
    system: "▣",
  };

  return (
    <label className={`theme-control ${compact ? "theme-control--compact" : ""}`}>
      <span className="sr-only">{text.theme}</span>
      <span aria-hidden="true" className="theme-control__icon">
        {icons[context.theme]}
      </span>
      <select
        aria-label={text.choose}
        value={context.theme}
        onChange={(event) => context.setTheme(event.target.value as ThemePreference)}
      >
        <option value="light">{text.light}</option>
        <option value="dark">{text.dark}</option>
        <option value="system">{text.system}</option>
      </select>
    </label>
  );
}
