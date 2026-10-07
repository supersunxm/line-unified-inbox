import type { Metadata } from "next";
import { StoreScorecardView } from "@/components/v2/store-scorecard-view";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("สาขา (v2)") };

export default function V2StoresPage() {
  return <StoreScorecardView />;
}
