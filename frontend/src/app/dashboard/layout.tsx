import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";
import { AuthorizedSection } from "../authorized-workspace";

export const metadata: Metadata = { title: internalPageTitle("แดชบอร์ด") };

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <AuthorizedSection section="dashboard">{children}</AuthorizedSection>;
}
