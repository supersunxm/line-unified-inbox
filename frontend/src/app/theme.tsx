"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  isThemePreference,
  loadTheme,
  resolveTheme,
  saveTheme,
  THEME_STORAGE_KEY,
} from "./theme-logic";
import type { ThemePreference } from "./theme-logic";

const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyResolvedTheme(theme: ThemePreference, systemDark: boolean) {
  const resolvedTheme = resolveTheme(theme, systemDark);
  document.documentElement.dataset.theme = resolvedTheme;
  document.documentElement.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>("system");

  useEffect(() => {
    const savedTheme = loadTheme(window.localStorage);
    const timer = window.setTimeout(() => {
      setThemeState(savedTheme);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const effectiveTheme =
      theme === "system" && isThemePreference(savedTheme) ? savedTheme : theme;
    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      if (effectiveTheme === "system") applyResolvedTheme(effectiveTheme, event.matches);
    };

    applyResolvedTheme(effectiveTheme, media.matches);
    media.addEventListener("change", handleSystemThemeChange);
    return () => media.removeEventListener("change", handleSystemThemeChange);
  }, [theme]);

  const setTheme = (nextTheme: ThemePreference) => {
    saveTheme(window.localStorage, nextTheme);
    setThemeState(nextTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeControl({ compact = false }: { compact?: boolean }) {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeControl must be used inside ThemeProvider");

  const icons: Record<ThemePreference, string> = {
    light: "☀",
    dark: "☾",
    system: "▣",
  };

  return (
    <label className={`theme-control ${compact ? "theme-control--compact" : ""}`}>
      <span className="sr-only">Theme</span>
      <span aria-hidden="true" className="theme-control__icon">
        {icons[context.theme]}
      </span>
      <select
        aria-label="Choose color theme"
        value={context.theme}
        onChange={(event) => context.setTheme(event.target.value as ThemePreference)}
      >
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="system">System</option>
      </select>
    </label>
  );
}
