import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("LINE Chat Health") };

export default function LineChatHealthLayout({ children }: { children: ReactNode }) {
  return children;
}
