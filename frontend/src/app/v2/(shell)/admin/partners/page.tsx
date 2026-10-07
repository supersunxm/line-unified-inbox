import type { Metadata } from "next";
import { StorePartnersAdmin } from "@/components/v2/store-partners-admin";
import { internalPageTitle } from "@/lib/page-title";

export const metadata: Metadata = { title: internalPageTitle("Partner ของสาขา (v2)") };

export default function V2StorePartnersPage() {
  return <StorePartnersAdmin />;
}
