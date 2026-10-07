// Partner (dealer) of a store. Pure: node --test imports it directly.
//
// Neither Store nor StoreMaster has a partner/dealer field (checked 2026-10-07: StoreMaster
// has dashboardTier, kpiPlan, dashboardArea and bmName, none of which is the partner).
// The partner is therefore read from the store name's "By <partner>" suffix, which the
// OPPO store master uses for every store ("OBS Central Phitsanulok By OPPO 2"):
//   1. take the text after the last " By " (case-insensitive);
//   2. strip a trailing branch number ("TG 2" → "TG");
//   3. look the result up in PARTNER_ALIASES by its compact key (letters and digits only,
//      upper case), so spelling variants land on one name ("IT CITY" / "IT City" → "IT City").
// Names without the suffix go to UNMATCHED_PARTNER and are listed in the report.

export const UNMATCHED_PARTNER = "ไม่ระบุ partner";

/**
 * Compact key → display name. Only variants seen in the store master are mapped; a new
 * spelling falls through to its own trimmed text (still grouped, just under its own name).
 */
export const PARTNER_ALIASES: Readonly<Record<string, string>> = {
  OPPO: "OPPO",
  COM7: "Com7",
  TG: "TG",
  ITCITY: "IT City",
  SIAMTV: "Siam TV",
  LCBMOBILESUPPLY: "LCB Mobile Supply",
  VTEC: "VTEC",
  JAYMART: "Jaymart",
};

export function partnerKey(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9ก-๙]/g, "");
}

const SUFFIX = /^.*\sby\s+(.+?)\s*$/i;

/** The partner named in a store name, or null when the name has no "By <partner>" suffix. */
export function partnerFromStoreName(storeName: string | null | undefined): string | null {
  if (!storeName) return null;
  const match = SUFFIX.exec(storeName.replace(/\s+/g, " ").trim());
  if (!match) return null;
  const raw = match[1].replace(/\s+\d+$/, "").trim();
  if (!raw || /^\d+$/.test(raw)) return null;
  return PARTNER_ALIASES[partnerKey(raw)] ?? raw;
}

/** The partner, or UNMATCHED_PARTNER. */
export function partnerOf(storeName: string | null | undefined): string {
  return partnerFromStoreName(storeName) ?? UNMATCHED_PARTNER;
}

/** Partner names in display order: by name, with UNMATCHED_PARTNER last. */
export function sortPartnerNames(names: Iterable<string>): string[] {
  return [...new Set(names)].sort((a, b) => {
    if (a === UNMATCHED_PARTNER) return 1;
    if (b === UNMATCHED_PARTNER) return -1;
    return a.localeCompare(b, "en", { sensitivity: "base" });
  });
}
