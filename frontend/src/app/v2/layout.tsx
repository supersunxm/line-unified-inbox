import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";
import { V2Layout } from "@/components/v2/v2-layout";

export const metadata: Metadata = { title: internalPageTitle("วันนี้ (v2)") };

export default function V2RootLayout({ children }: { children: ReactNode }) {
  return <V2Layout>{children}</V2Layout>;
}
