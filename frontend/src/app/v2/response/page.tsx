import type { Metadata } from "next";
import { Suspense } from "react";
import { internalPageTitle } from "@/lib/page-title";
import { ResponseView } from "@/components/v2/response-view";

export const metadata: Metadata = { title: internalPageTitle("การตอบแชท (v2)") };

export default function V2ResponsePage() {
  // useSearchParams needs a Suspense boundary so the route can still be prerendered.
  return (
    <Suspense fallback={null}>
      <ResponseView />
    </Suspense>
  );
}
