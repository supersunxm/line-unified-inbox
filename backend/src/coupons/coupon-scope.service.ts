import { BadRequestException, Injectable } from "@nestjs/common";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import type { CouponScopeItem, CouponStoreSelection } from "./coupon.types";

@Injectable()
export class CouponScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  async resolve(selection: CouponStoreSelection, user: AuthUser): Promise<CouponScopeItem[]> {
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const requestedStoreIds = selection.storeIds ?? [];

    if (selection.mode !== "ALL" && selection.mode !== "SELECTED") {
      throw new BadRequestException("Invalid store selection mode");
    }
    if (selection.mode === "SELECTED" && requestedStoreIds.length === 0) {
      throw new BadRequestException("Store selection is empty");
    }

    const stores = await this.prisma.store.findMany({
      where:
        selection.mode === "ALL"
          ? { ...(accessibleStoreIds ? { id: { in: accessibleStoreIds } } : {}) }
          : { id: { in: requestedStoreIds } },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        archivedAt: true,
        lineOfficialAccounts: {
          where: { isActive: true, archivedAt: null },
          select: {
            id: true,
            name: true,
            isActive: true,
            archivedAt: true,
            encryptedChannelAccessToken: true,
          },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    return stores.map((store) => {
      const oa = store.lineOfficialAccounts[0];
      const unauthorized = accessibleStoreIds !== null && !accessibleStoreIds.includes(store.id);
      const base = {
        storeId: store.id,
        storeName: store.name,
        storeCode: store.code,
        lineOfficialAccountId: oa?.id ?? null,
        lineOaName: oa?.name ?? null,
      };

      if (unauthorized) {
        return { ...base, encryptedChannelAccessToken: null, isEligible: false, skipReason: "UNAUTHORIZED" as const };
      }
      if (!store.isActive || store.archivedAt) {
        return { ...base, encryptedChannelAccessToken: null, isEligible: false, skipReason: "STORE_NOT_ACTIVE" as const };
      }
      if (!oa || !oa.isActive || oa.archivedAt) {
        return { ...base, encryptedChannelAccessToken: null, isEligible: false, skipReason: "INVALID_CONNECTION" as const };
      }
      if (!oa.encryptedChannelAccessToken) {
        return { ...base, encryptedChannelAccessToken: null, isEligible: false, skipReason: "MISSING_TOKEN" as const };
      }

      try {
        this.encryption.decrypt(oa.encryptedChannelAccessToken);
      } catch {
        return { ...base, encryptedChannelAccessToken: null, isEligible: false, skipReason: "MISSING_TOKEN" as const };
      }

      return {
        ...base,
        encryptedChannelAccessToken: oa.encryptedChannelAccessToken,
        isEligible: true,
        skipReason: null,
      };
    });
  }
}
