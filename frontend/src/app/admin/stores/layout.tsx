import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("จัดการร้านค้า") };

export default function AdminStoresLayout({ children }: { children: ReactNode }) {
  return children;
}
