import type { Metadata } from "next";
import { StoresView } from "@/components/v2/stores-view";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("สาขา (v2)") };

export default function V2StoresPage() {
  return <StoresView />;
}
