// Partner (dealer) of a store. Pure: node --test imports it directly.
//
// The partner comes from the backend's Store → partner mapping, keyed by Store ID
// (GET /v2/store-partners, owner decision 7 Oct 2026). The frontend never parses store names.
// A store without a mapped partner reads as UNMATCHED_PARTNER.

export const UNMATCHED_PARTNER = "ไม่ระบุ partner";

/** The mapped partner, or UNMATCHED_PARTNER. */
export function partnerOrUnmatched(partner: string | null | undefined): string {
  const trimmed = partner?.trim();
  return trimmed ? trimmed : UNMATCHED_PARTNER;
}

/** Partner names in display order: by name, with UNMATCHED_PARTNER last. */
export function sortPartnerNames(names: Iterable<string>): string[] {
  return [...new Set(names)].sort((a, b) => {
    if (a === UNMATCHED_PARTNER) return 1;
    if (b === UNMATCHED_PARTNER) return -1;
    return a.localeCompare(b, "en", { sensitivity: "base" });
  });
}

/** A row of GET /v2/store-partners. */
export type StorePartnerRow = { storeUuid: string; storeId: string | null; storeName: string; partner: string | null; updatedAt: string | null; updatedByName: string | null };
