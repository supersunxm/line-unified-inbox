// The one-time seed of the Store → partner mapping reads the "By <partner>" suffix of the store
// name. After the seed, v2 reads partner only from StorePartnerMapping (keyed by Store ID);
// names are never parsed at read time.
//   1. text after the last " By " (case-insensitive);
//   2. a trailing branch number is stripped ("TG 2" → "TG");
//   3. spelling variants map to one name by compact key (PARTNER_ALIASES).
// Pairs that may be different companies are deliberately NOT merged (AMBIGUOUS_PARTNER_PAIRS).

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

/** Seeded as separate partners; the owner decides whether each pair is one company. */
export const AMBIGUOUS_PARTNER_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["JP", "JP Store"],
  ["INTERCOM", "Inter Computer & IT"],
];

export function partnerKey(value: string): string {
  return value.normalize("NFKC").toUpperCase().replace(/[^A-Z0-9ก-๙]/g, "");
}

const SUFFIX = /^.*\sby\s+(.+?)\s*$/i;

export function partnerFromStoreName(storeName: string | null | undefined): string | null {
  if (!storeName) return null;
  const match = SUFFIX.exec(storeName.replace(/\s+/g, " ").trim());
  if (!match) return null;
  const raw = match[1].replace(/\s+\d+$/, "").trim();
  if (!raw || /^\d+$/.test(raw)) return null;
  return PARTNER_ALIASES[partnerKey(raw)] ?? raw;
}

/** A partner name as stored: trimmed, single-spaced, at most 100 characters; empty → null. */
export function normalizePartnerInput(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;
  if (trimmed.length > 100) throw new Error("PARTNER_NAME_TOO_LONG");
  return trimmed;
}
