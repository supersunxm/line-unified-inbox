import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";
import { LineChatHealthI18nBoundary } from "./LineChatHealthI18nBoundary";

export const metadata: Metadata = { title: internalPageTitle("LINE Chat Health") };

export default function LineChatHealthLayout({ children }: { children: ReactNode }) {
  return <LineChatHealthI18nBoundary>{children}</LineChatHealthI18nBoundary>;
}
