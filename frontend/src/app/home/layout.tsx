import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";
import { AuthorizedSection } from "../authorized-workspace";

export const metadata: Metadata = { title: internalPageTitle("หน้าหลัก") };

export default function HomeLayout({ children }: { children: ReactNode }) {
  return <AuthorizedSection section="home">{children}</AuthorizedSection>;
}
