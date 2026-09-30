import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("Download Center") };

export default function DownloadCenterLayout({ children }: { children: ReactNode }) {
  return children;
}
