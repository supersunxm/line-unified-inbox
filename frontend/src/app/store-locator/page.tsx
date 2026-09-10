import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { StoreLocatorApp } from "./store-locator-app";

export const metadata: Metadata = {
  title: {
    absolute: "ค้นหาสาขา OPPO | Store Locator",
  },
  description: "ค้นหาสาขา OPPO ตามภูมิภาค จังหวัด และชื่อสาขา พร้อมแชทกับสาขาผ่าน LINE",
};

const STORE_LOCATOR_LIGHT_THEME = {
  "--app-bg": "#f5f5f7",
  "--app-surface": "#ffffff",
  "--app-surface-subtle": "#f9f9fb",
  "--app-surface-hover": "#f2f4f7",
  "--app-surface-active": "#e8edf5",
  "--app-border": "#e5e5ea",
  "--app-border-subtle": "#f0f0f4",
  "--app-border-strong": "#d1d1d6",
  "--app-text-primary": "#1d1d1f",
  "--app-text-secondary": "#6e6e73",
  "--app-text-tertiary": "#a1a1a6",
  "--app-text-disabled": "#c7c7cc",
  "--app-accent": "#00a651",
  "--app-accent-hover": "#008f46",
  "--app-accent-soft": "#e8f9ec",
  "--app-accent-contrast": "#ffffff",
  "--app-shadow-card": "0 1px 2px rgba(0, 0, 0, 0.04)",
  "--app-shadow-elevated": "0 4px 12px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04)",
  "--disabled-background": "#f1f5f9",
  "--disabled-foreground": "#94a3b8",
  "--input-background": "#ffffff",
  "--background": "#f5f5f7",
  "--foreground": "#1d1d1f",
  "--surface": "#ffffff",
  "--surface-elevated": "#f9f9fb",
  "--border": "#e5e5ea",
  "--muted": "#6e6e73",
  "--color-white": "#ffffff",
} as CSSProperties;

export default function StoreLocatorPage() {
  return (
    <div style={STORE_LOCATOR_LIGHT_THEME} className="min-h-screen bg-[#f5f5f7] text-[#1d1d1f] [color-scheme:light]">
      <StoreLocatorApp />
    </div>
  );
}
