"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type AppLanguage = "th" | "en" | "zh";

const LANGUAGE_STORAGE_KEY = "oppo-line-oa-language";
const LEGACY_UI_PREFERENCES_KEY = "oppo-line-oa-monitor-ui-preferences";

function isLanguage(value: unknown): value is AppLanguage {
  return value === "th" || value === "en" || value === "zh";
}

function readLegacyWorkspaceLanguage(): AppLanguage | null {
  try {
    const legacy = window.localStorage.getItem(LEGACY_UI_PREFERENCES_KEY);
    if (!legacy) return null;
    const parsed = JSON.parse(legacy) as { language?: unknown };
    return isLanguage(parsed.language) ? parsed.language : null;
  } catch {
    return null;
  }
}

function readInitialLanguage(): AppLanguage {
  if (typeof window === "undefined") return "th";
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (isLanguage(saved)) return saved;
    const legacyLanguage = readLegacyWorkspaceLanguage();
    if (legacyLanguage) return legacyLanguage;
  } catch {
    // Fall through to browser-language detection.
  }

  const browserLanguage = window.navigator.language.toLowerCase();
  if (browserLanguage.startsWith("zh")) return "zh";
  if (browserLanguage.startsWith("th")) return "th";
  return "en";
}

function persistLanguage(language: AppLanguage) {
  try {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    const legacyRaw = window.localStorage.getItem(LEGACY_UI_PREFERENCES_KEY);
    const legacy = legacyRaw ? JSON.parse(legacyRaw) as Record<string, unknown> : {};
    if (legacy.language !== language) {
      window.localStorage.setItem(LEGACY_UI_PREFERENCES_KEY, JSON.stringify({ ...legacy, language }));
    }
  } catch {
    // Storage can be unavailable in privacy-restricted browsers.
  }
}

type LanguageContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<AppLanguage>("th");

  useEffect(() => {
    setLanguage(readInitialLanguage());
  }, []);

  useEffect(() => {
    persistLanguage(language);
    document.documentElement.lang = language === "zh" ? "zh-CN" : language;
  }, [language]);

  useEffect(() => {
    const syncFromWorkspace = () => {
      const workspaceLanguage = readLegacyWorkspaceLanguage();
      if (workspaceLanguage) setLanguage((current) => current === workspaceLanguage ? current : workspaceLanguage);
    };
    const timer = window.setInterval(syncFromWorkspace, 500);
    window.addEventListener("focus", syncFromWorkspace);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", syncFromWorkspace);
    };
  }, []);

  const value = useMemo(() => ({ language, setLanguage }), [language]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useAppLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useAppLanguage must be used inside LanguageProvider");
  return context;
}

const languageNames: Record<AppLanguage, string> = {
  th: "ไทย",
  en: "EN",
  zh: "中文",
};

export function LanguageControl({ className = "" }: { className?: string }) {
  const { language, setLanguage } = useAppLanguage();
  return (
    <div className={`inline-flex rounded-xl border border-[var(--app-border,#cbd5e1)] bg-[var(--app-surface,#fff)] p-1 shadow-sm ${className}`} role="group" aria-label="Language / ภาษา / 语言">
      {(Object.keys(languageNames) as AppLanguage[]).map((item) => (
        <button key={item} type="button" onClick={() => setLanguage(item)} aria-pressed={language === item} className={`min-h-8 rounded-lg px-2.5 text-xs font-semibold transition-colors ${language === item ? "bg-[var(--app-accent,#111827)] text-white" : "text-[var(--app-text-secondary,#475569)] hover:bg-[var(--app-surface-subtle,#f1f5f9)]"}`}>
          {languageNames[item]}
        </button>
      ))}
    </div>
  );
}

export function pickLanguageText<T>(language: AppLanguage, translations: Record<AppLanguage, T>): T {
  return translations[language];
}
