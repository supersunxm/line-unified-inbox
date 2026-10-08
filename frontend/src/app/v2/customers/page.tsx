import { redirect } from "next/navigation";
import { v2RedirectHref } from "../v2-redirects";

/** Retired v2 page (8 Oct 2026): see v2-redirects.ts. */
export default async function V2RetiredPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  redirect(v2RedirectHref("customers", await searchParams));
}
