import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("แชทร้านค้า") };

export default function ChatsLayout({ children }: { children: ReactNode }) {
  return children;
}
