import {
  formatPublicRegion,
  normalizePublicRegion,
} from "../../lib/public-regions.ts";
import type { PublicStoreDto } from "../../lib/public-stores-api.ts";

export const STORE_LOCATOR_REGION_ORDER = [
  "ภาคเหนือ",
  "ภาคกลาง",
  "ภาคตะวันออกเฉียงเหนือ",
  "ภาคตะวันออก",
  "ภาคตะวันตก",
  "ภาคใต้",
] as const;

const REGION_ALIASES: Record<string, string> = {
  north: "ภาคเหนือ",
  northeast: "ภาคตะวันออกเฉียงเหนือ",
  "north east": "ภาคตะวันออกเฉียงเหนือ",
  east: "ภาคตะวันออก",
  west: "ภาคตะวันตก",
  south: "ภาคใต้",
};

function normalizeForSearch(value: string): string {
  return value.normalize("NFKC").trim().toLocaleLowerCase();
}

export function getStoreLocatorRegion(rawRegion: string | null | undefined): string | null {
  const normalized = normalizePublicRegion(rawRegion);
  if (!normalized) return null;

  const aliased = REGION_ALIASES[normalized.toLocaleLowerCase()];
  if (aliased) return aliased;

  return STORE_LOCATOR_REGION_ORDER.includes(
    normalized as (typeof STORE_LOCATOR_REGION_ORDER)[number],
  )
    ? normalized
    : null;
}

export function getStoreLocatorRegions(stores: PublicStoreDto[]): string[] {
  const available = new Set(
    stores
      .map((store) => getStoreLocatorRegion(store.region))
      .filter((region): region is string => region !== null),
  );

  return STORE_LOCATOR_REGION_ORDER.filter((region) => available.has(region));
}

export function getStoreLocatorRegionCount(
  stores: PublicStoreDto[],
  region: string,
): number {
  return stores.filter((store) => getStoreLocatorRegion(store.region) === region).length;
}

export function getStoreLocatorProvinces(
  stores: PublicStoreDto[],
  region: string,
): string[] {
  return Array.from(
    new Set(
      stores
        .filter((store) => getStoreLocatorRegion(store.region) === region)
        .map((store) => store.province?.trim())
        .filter((province): province is string => Boolean(province)),
    ),
  ).sort((left, right) => left.localeCompare(right, "th"));
}

export function matchesStoreLocatorQuery(
  store: PublicStoreDto,
  query: string,
): boolean {
  const normalizedQuery = normalizeForSearch(query);
  if (!normalizedQuery) return true;

  const searchableText = [
    store.name,
    store.province,
    store.location.addressPreview,
    store.region,
    formatPublicRegion(store.region),
  ]
    .filter((value): value is string => Boolean(value))
    .map(normalizeForSearch)
    .join(" ");

  return searchableText.includes(normalizedQuery);
}

export function getSafeStoreLocatorLineUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl?.trim()) return null;

  try {
    const url = new URL(rawUrl.trim());
    const hostname = url.hostname.toLocaleLowerCase();
    const allowedHost =
      hostname === "lin.ee" || hostname === "line.me" || hostname.endsWith(".line.me");

    return url.protocol === "https:" && allowedHost && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
