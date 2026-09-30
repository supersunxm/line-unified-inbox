import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";
import { LegacyI18nBoundary } from "../../legacy-i18n-boundary";
import { registrationPhrases, registrationTemplates } from "./registrations-i18n";

export const metadata: Metadata = { title: internalPageTitle("อนุมัติ BM") };

export default function RegistrationsLayout({ children }: { children: ReactNode }) {
  return (
    <LegacyI18nBoundary phrases={registrationPhrases} templates={registrationTemplates}>
      {children}
    </LegacyI18nBoundary>
  );
}
