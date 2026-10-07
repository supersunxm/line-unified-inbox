import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";
import { Store360I18nBoundary } from "./Store360I18nBoundary";

export const metadata: Metadata = { title: internalPageTitle("Store 360") };

export default function Store360Layout({ children }: { children: ReactNode }) {
  return <Store360I18nBoundary>{children}</Store360I18nBoundary>;
}
