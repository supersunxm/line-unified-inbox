export type AppLanguage = "th" | "en" | "zh";

export function pickLanguageText<T>(language: AppLanguage, translations: Record<AppLanguage, T>): T {
  return translations[language];
}

export function languageLocale(language: AppLanguage): string {
  return language === "zh" ? "zh-CN" : language === "th" ? "th-TH" : "en-US";
}
