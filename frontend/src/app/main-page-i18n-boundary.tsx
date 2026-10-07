"use client";

import type { ReactNode } from "react";
import { LegacyI18nBoundary } from "./legacy-i18n-boundary";
import { mainPagePhrases } from "./main-page-i18n";

export function MainPageI18nBoundary({ children }: { children: ReactNode }) {
  return <LegacyI18nBoundary phrases={mainPagePhrases} showControl={false}>{children}</LegacyI18nBoundary>;
}
