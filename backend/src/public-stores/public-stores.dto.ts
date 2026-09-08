import type { StoreMaster } from "@prisma/client";

export interface PublicStoreLineInfo {
  url: string;
  basicId: string | null;
}

export interface PublicStoreTikTokInfo {
  username: string | null;
  profileUrl: string;
}

export interface PublicStoreLocationInfo {
  addressPreview: string;
  mapsUrl: string | null;
}

export interface PublicStoreDto {
  id: string;
  slug: string;
  name: string;
  accountName: string;
  province: string | null;
  region: string | null;
  location: PublicStoreLocationInfo;
  line: PublicStoreLineInfo | null;
  tiktok: PublicStoreTikTokInfo | null;
}

export interface PublicStoreListResponse {
  stores: PublicStoreDto[];
  total: number;
  filters: {
    provinces: string[];
    regions: string[];
  };
}

export function generatePublicStoreSlug(storeName: string, externalStoreId?: string | null): string {
  const base = storeName
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = externalStoreId ? `-${externalStoreId}` : "";
  if (!base) return `store${suffix}`;
  return `${base}${suffix}`;
}

export function serializePublicStore(store: StoreMaster): PublicStoreDto {
  const externalId = store.externalStoreId || store.id;
  const slug = generatePublicStoreSlug(store.storeName, store.externalStoreId);

  const line: PublicStoreLineInfo | null = store.lineOaLink
    ? {
        url: store.lineOaLink,
        basicId: store.lineId ?? null,
      }
    : null;

  const tiktok: PublicStoreTikTokInfo | null =
    store.tiktokProfileUrl || store.tiktokUsername
      ? {
          username: store.tiktokUsername ?? null,
          profileUrl:
            store.tiktokProfileUrl ||
            (store.tiktokUsername ? `https://www.tiktok.com/@${store.tiktokUsername}` : ""),
        }
      : null;

  const addressParts: string[] = [store.storeName];
  if (store.province) addressParts.push(store.province);
  if (store.region && store.region !== store.province) addressParts.push(store.region);

  const location: PublicStoreLocationInfo = {
    addressPreview: addressParts.join(", "),
    mapsUrl: store.googleMapsUrl ?? null,
  };

  return {
    id: externalId,
    slug,
    name: store.storeName,
    accountName: store.accountName,
    province: store.province ?? null,
    region: store.region ?? null,
    location,
    line,
    tiktok,
  };
}
