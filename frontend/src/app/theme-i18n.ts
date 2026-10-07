import type { AppLanguage } from "./language-utils";

export const themeControlLabels = {
  th: { theme: "ธีม", choose: "เลือกธีมสี", light: "สว่าง", dark: "มืด", system: "ตามระบบ" },
  en: { theme: "Theme", choose: "Choose color theme", light: "Light", dark: "Dark", system: "System" },
  zh: { theme: "主题", choose: "选择颜色主题", light: "浅色", dark: "深色", system: "跟随系统" },
} satisfies Record<AppLanguage, Record<string, string>>;
