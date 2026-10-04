import type { Metadata } from "next";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("วันนี้ (v2)") };

export default function V2TodayPage() {
  return null;
}
