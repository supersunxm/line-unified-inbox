"use client";

import type { ReactNode } from "react";
import { LegacyI18nBoundary } from "../legacy-i18n-boundary";
import { store360Phrases } from "./store-360-i18n";

export function Store360I18nBoundary({ children }: { children: ReactNode }) {
  return <LegacyI18nBoundary phrases={store360Phrases} showControl={false}>{children}</LegacyI18nBoundary>;
}
