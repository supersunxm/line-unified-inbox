import type { Metadata } from "next";
import { internalPageTitle } from "@/lib/page-title";
import { TodayView } from "@/components/v2/today-view";

export const metadata: Metadata = { title: internalPageTitle("วันนี้ (v2)") };

export default function V2TodayPage() {
  return <TodayView />;
}
