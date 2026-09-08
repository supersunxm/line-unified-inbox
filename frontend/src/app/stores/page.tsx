import { Suspense } from "react";
import type { Metadata } from "next";
import { PublicStoresDirectory } from "./public-stores-directory";

export const metadata: Metadata = {
  title: "OPPO Brand Shop Store Directory",
  description: "ค้นหา OPPO Brand Shop และช่องทางติดต่อของสาขา",
};

export default function StoresDirectoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--app-bg)]" />}>
      <PublicStoresDirectory />
    </Suspense>
  );
}
