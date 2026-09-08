import { API_BASE_URL } from "./runtime-config.ts";

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

export interface PublicStoresFilterParams {
  q?: string;
  province?: string;
  region?: string;
  limit?: number;
}

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return API_BASE_URL;
  }
  return "/api-backend";
}

export async function fetchPublicStores(
  params: PublicStoresFilterParams = {},
  options?: { signal?: AbortSignal }
): Promise<PublicStoreListResponse> {
  const query = new URLSearchParams();
  if (params.q?.trim()) query.set("q", params.q.trim());
  if (params.province?.trim() && params.province !== "ALL") query.set("province", params.province.trim());
  if (params.region?.trim() && params.region !== "ALL") query.set("region", params.region.trim());
  if (params.limit && params.limit > 0) query.set("limit", params.limit.toString());

  const queryString = query.toString();
  const url = `${getBaseUrl()}/public/stores${queryString ? `?${queryString}` : ""}`;

  const response = await fetch(url, {
    cache: "no-store",
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch stores (${response.status})`);
  }

  return response.json() as Promise<PublicStoreListResponse>;
}

export async function fetchPublicStoreByIdentifier(
  identifier: string,
  options?: { signal?: AbortSignal }
): Promise<PublicStoreDto | null> {
  const url = `${getBaseUrl()}/public/stores/${encodeURIComponent(identifier.trim())}`;
  const response = await fetch(url, {
    cache: "no-store",
    signal: options?.signal,
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch store details (${response.status})`);
  }

  return response.json() as Promise<PublicStoreDto>;
}
