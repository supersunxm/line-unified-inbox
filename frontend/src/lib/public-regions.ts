/**
 * Public Region Normalization Layer
 *
 * StoreMaster contains raw legacy region values from master file imports
 * (e.g. "Central", "Central Thailand", "Northern", "Western", etc.).
 *
 * This presentation layer normalizes equivalent regions into consistent,
 * user-friendly Thai customer-facing labels without mutating database source data.
 */

export const PUBLIC_REGION_MAP: Record<string, string> = {
  central: "ภาคกลาง",
  "central thailand": "ภาคกลาง",
  "central-thailand": "ภาคกลาง",
  "ภาคกลาง": "ภาคกลาง",
  northern: "ภาคเหนือ",
  "ภาคเหนือ": "ภาคเหนือ",
  northeastern: "ภาคตะวันออกเฉียงเหนือ",
  "ภาคตะวันออกเฉียงเหนือ": "ภาคตะวันออกเฉียงเหนือ",
  southern: "ภาคใต้",
  "ภาคใต้": "ภาคใต้",
  eastern: "ภาคตะวันออก",
  "ภาคตะวันออก": "ภาคตะวันออก",
  western: "ภาคตะวันตก",
  "ภาคตะวันตก": "ภาคตะวันตก",
};

const PUBLIC_REGION_LABELS: Record<string, { th: string; en: string; zh: string }> = {
  "ภาคกลาง": { th: "ภาคกลาง", en: "Central Thailand", zh: "泰国中部" },
  "ภาคเหนือ": { th: "ภาคเหนือ", en: "Northern Thailand", zh: "泰国北部" },
  "ภาคตะวันออกเฉียงเหนือ": { th: "ภาคตะวันออกเฉียงเหนือ", en: "Northeastern Thailand", zh: "泰国东北部" },
  "ภาคใต้": { th: "ภาคใต้", en: "Southern Thailand", zh: "泰国南部" },
  "ภาคตะวันออก": { th: "ภาคตะวันออก", en: "Eastern Thailand", zh: "泰国东部" },
  "ภาคตะวันตก": { th: "ภาคตะวันตก", en: "Western Thailand", zh: "泰国西部" },
};

/**
 * Standard customer-facing display order for Thai geographical regions.
 */
export const ORDERED_PUBLIC_REGIONS: string[] = [
  "ภาคกลาง",
  "ภาคเหนือ",
  "ภาคตะวันออกเฉียงเหนือ",
  "ภาคใต้",
  "ภาคตะวันออก",
  "ภาคตะวันตก",
];

/**
 * Normalize any region string (English, Thai, case-insensitive) to canonical Thai public label.
 * Returns null if input is empty or unmapped.
 */
export function normalizePublicRegion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  return PUBLIC_REGION_MAP[trimmed] ?? raw.trim();
}

/**
 * Format region for public customer display on store cards and profiles.
 * Returns a non-empty string or fallback empty string.
 */
export function formatPublicRegion(raw: string | null | undefined, language: "th" | "en" | "zh" = "th"): string {
  if (!raw) return "";
  const normalized = normalizePublicRegion(raw);
  return normalized ? PUBLIC_REGION_LABELS[normalized]?.[language] ?? normalized : raw.trim();
}

/**
 * Check if a store's raw region matches the user-selected region filter.
 * Supports:
 * - "ALL" -> matches everything
 * - Canonical Thai label (e.g. "ภาคกลาง")
 * - Legacy raw English values (e.g. "Central", "Central Thailand")
 */
export function matchesPublicRegion(
  storeRawRegion: string | null | undefined,
  selectedRegion: string
): boolean {
  if (!selectedRegion || selectedRegion === "ALL") return true;
  if (!storeRawRegion) return false;

  const normalizedStoreRegion = normalizePublicRegion(storeRawRegion);
  const normalizedSelectedRegion = normalizePublicRegion(selectedRegion);

  if (normalizedStoreRegion && normalizedSelectedRegion) {
    return normalizedStoreRegion.toLowerCase() === normalizedSelectedRegion.toLowerCase();
  }

  return storeRawRegion.trim().toLowerCase() === selectedRegion.trim().toLowerCase();
}

/**
 * Get unique deduplicated public region labels from a list of raw regions.
 * Preserves standard ordered geographical sequence.
 */
export function getDeduplicatedPublicRegions(rawRegions: string[]): string[] {
  const normalizedSet = new Set<string>();

  for (const raw of rawRegions) {
    const norm = normalizePublicRegion(raw);
    if (norm) {
      normalizedSet.add(norm);
    }
  }

  const result: string[] = [];
  // First add standard regions in order if present in source data
  for (const reg of ORDERED_PUBLIC_REGIONS) {
    if (normalizedSet.has(reg)) {
      result.push(reg);
      normalizedSet.delete(reg);
    }
  }
  // Then append any remaining unexpected regions in alphabetical order
  const remaining = Array.from(normalizedSet).sort((a, b) => a.localeCompare(b));
  return [...result, ...remaining];
}
