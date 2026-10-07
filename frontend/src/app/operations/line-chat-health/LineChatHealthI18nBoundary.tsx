"use client";

import type { ReactNode } from "react";
import { LegacyI18nBoundary } from "../../legacy-i18n-boundary";
import { lineChatHealthPhrases, lineChatHealthTemplates } from "./line-chat-health-i18n";

export function LineChatHealthI18nBoundary({ children }: { children: ReactNode }) {
  return <LegacyI18nBoundary phrases={lineChatHealthPhrases} templates={lineChatHealthTemplates} showControl={false}>{children}</LegacyI18nBoundary>;
}
