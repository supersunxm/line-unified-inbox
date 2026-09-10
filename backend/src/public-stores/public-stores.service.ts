import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import {
  type PublicStoreDto,
  type PublicStoreListResponse,
  generatePublicStoreSlug,
  localizePublicProvince,
  serializePublicStore,
} from "./public-stores.dto";
import { normalizeSearchText } from "../store-master/store-master.utils";

export interface PublicStoresQueryParams {
  q?: string;
  province?: string;
  region?: string;
  limit?: number;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class PublicStoresService {
  constructor(private readonly prisma: PrismaService) {}

  async getStores(params: PublicStoresQueryParams = {}): Promise<PublicStoreListResponse> {
    const allActiveStores = await this.prisma.storeMaster.findMany({
      where: { isActive: true },
      orderBy: [{ province: "asc" }, { storeName: "asc" }],
    });

    const provincesSet = new Set<string>();
    const regionsSet = new Set<string>();

    for (const store of allActiveStores) {
      const localizedProvince = localizePublicProvince(store.province);
      if (localizedProvince) provincesSet.add(localizedProvince);
      if (store.region?.trim()) regionsSet.add(store.region.trim());
    }

    const availableProvinces = Array.from(provincesSet).sort((a, b) => a.localeCompare(b, "th"));
    const availableRegions = Array.from(regionsSet).sort((a, b) => a.localeCompare(b));

    let filtered = allActiveStores;

    if (params.region?.trim()) {
      const targetRegion = params.region.trim().toLowerCase();
      filtered = filtered.filter(
        (s) => s.region && s.region.trim().toLowerCase() === targetRegion
      );
    }

    if (params.province?.trim()) {
      const targetProvince = params.province.trim().toLocaleLowerCase();
      filtered = filtered.filter((s) => {
        const rawProvince = s.province?.trim().toLocaleLowerCase();
        const localizedProvince = localizePublicProvince(s.province)?.toLocaleLowerCase();
        return rawProvince === targetProvince || localizedProvince === targetProvince;
      });
    }

    if (params.q?.trim()) {
      const rawQuery = params.q.trim().toLocaleLowerCase();
      const normalizedQuery = normalizeSearchText(params.q);

      filtered = filtered.filter((store) => {
        const nameLower = store.storeName.toLocaleLowerCase();
        const accountLower = store.accountName.toLocaleLowerCase();
        const provinceLower = (store.province ?? "").toLocaleLowerCase();
        const localizedProvinceLower = (localizePublicProvince(store.province) ?? "").toLocaleLowerCase();
        const regionLower = (store.region ?? "").toLocaleLowerCase();
        const externalIdLower = (store.externalStoreId ?? "").toLocaleLowerCase();

        return (
          nameLower.includes(rawQuery) ||
          accountLower.includes(rawQuery) ||
          provinceLower.includes(rawQuery) ||
          localizedProvinceLower.includes(rawQuery) ||
          regionLower.includes(rawQuery) ||
          externalIdLower.includes(rawQuery) ||
          store.normalizedAccountName.includes(normalizedQuery)
        );
      });
    }

    const limit = params.limit && params.limit > 0 ? params.limit : undefined;
    const paged = limit ? filtered.slice(0, limit) : filtered;

    return {
      stores: paged.map(serializePublicStore),
      total: filtered.length,
      filters: {
        provinces: availableProvinces,
        regions: availableRegions,
      },
    };
  }

  async getStoreByIdentifier(identifier: string): Promise<PublicStoreDto> {
    const rawIdentifier = identifier.trim();
    if (!rawIdentifier) {
      throw new NotFoundException("Store not found");
    }

    if (UUID_REGEX.test(rawIdentifier)) {
      throw new NotFoundException("Store not found");
    }

    let store = await this.prisma.storeMaster.findFirst({
      where: {
        externalStoreId: rawIdentifier,
        isActive: true,
      },
    });

    if (!store) {
      const trailingCodeMatch = rawIdentifier.match(/-([a-zA-Z0-9]+)$/);
      if (trailingCodeMatch?.[1]) {
        const candidate = await this.prisma.storeMaster.findFirst({
          where: {
            externalStoreId: trailingCodeMatch[1],
            isActive: true,
          },
        });
        if (
          candidate &&
          generatePublicStoreSlug(candidate.storeName, candidate.externalStoreId) === rawIdentifier
        ) {
          store = candidate;
        }
      }
    }

    if (!store) {
      const allActive = await this.prisma.storeMaster.findMany({
        where: { isActive: true },
      });
      store =
        allActive.find(
          (s) => generatePublicStoreSlug(s.storeName, s.externalStoreId) === rawIdentifier
        ) ?? null;
    }

    if (!store) {
      throw new NotFoundException("Store not found");
    }

    return serializePublicStore(store);
  }
}
