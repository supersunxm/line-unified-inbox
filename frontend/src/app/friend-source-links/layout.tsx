import type { Metadata } from "next";
import type { ReactNode } from "react";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("ลิงก์เพิ่มเพื่อน") };

export default function FriendSourceLinksLayout({ children }: { children: ReactNode }) {
  return children;
}
