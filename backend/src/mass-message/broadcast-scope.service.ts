import { BadRequestException, Injectable } from "@nestjs/common";
import { MassMessageStoreMode } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import type { BroadcastTargetingInput } from "./broadcast-targeting";
import type { BroadcastScopeItem, BroadcastStoreSelectionInput } from "./broadcast.types";

@Injectable()
export class BroadcastScopeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  async resolve(
    storeSelection: BroadcastStoreSelectionInput,
    targeting: BroadcastTargetingInput,
    user: AuthUser,
  ): Promise<BroadcastScopeItem[]> {
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    const requestedIds = storeSelection.storeIds ?? [];

    if (storeSelection.mode !== MassMessageStoreMode.ALL && requestedIds.length === 0) {
      throw new BadRequestException("Store selection is empty");
    }

    const stores = await this.prisma.store.findMany({
      where:
        storeSelection.mode === MassMessageStoreMode.ALL
          ? {
              isActive: true,
              archivedAt: null,
              ...(accessibleStoreIds ? { id: { in: accessibleStoreIds } } : {}),
            }
          : { id: { in: requestedIds } },
      select: {
        id: true,
        name: true,
        code: true,
        isActive: true,
        archivedAt: true,
        storeMaster: { select: { externalStoreId: true } },
        lineOfficialAccounts: {
          where: { isActive: true, archivedAt: null },
          select: {
            id: true,
            name: true,
            isActive: true,
            archivedAt: true,
            encryptedChannelAccessToken: true,
            followerSnapshots: {
              orderBy: { snapshotDate: "desc" },
              take: 1,
              select: {
                snapshotDate: true,
                followers: true,
                targetedReaches: true,
              },
            },
          },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    });

    const results: BroadcastScopeItem[] = [];

    for (const store of stores) {
      const masterStoreId = store.storeMaster?.externalStoreId ?? null;
      const base = {
        storeId: store.id,
        masterStoreId,
        externalStoreId: masterStoreId,
        storeName: store.name,
        storeCode: store.code,
      };

      if (accessibleStoreIds && !accessibleStoreIds.includes(store.id)) {
        results.push({
          ...base,
          lineOfficialAccountId: null,
          lineOaName: null,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "UNAUTHORIZED",
          warnings: [],
          estimatedReach: null,
          targetReach: null,
          followerCount: null,
          snapshotDate: null,
        });
        continue;
      }

      if (!store.isActive || store.archivedAt) {
        results.push({
          ...base,
          lineOfficialAccountId: null,
          lineOaName: null,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "STORE_NOT_ACTIVE",
          warnings: [],
          estimatedReach: null,
          targetReach: null,
          followerCount: null,
          snapshotDate: null,
        });
        continue;
      }

      const oa = store.lineOfficialAccounts[0];
      if (!oa || !oa.isActive || oa.archivedAt) {
        results.push({
          ...base,
          lineOfficialAccountId: oa?.id ?? null,
          lineOaName: oa?.name ?? null,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "INVALID_CONNECTION",
          warnings: [],
          estimatedReach: null,
          targetReach: null,
          followerCount: null,
          snapshotDate: null,
        });
        continue;
      }

      if (!oa.encryptedChannelAccessToken) {
        results.push({
          ...base,
          lineOfficialAccountId: oa.id,
          lineOaName: oa.name,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "MISSING_TOKEN",
          warnings: [],
          estimatedReach: null,
          targetReach: null,
          followerCount: null,
          snapshotDate: null,
        });
        continue;
      }

      try {
        this.encryption.decrypt(oa.encryptedChannelAccessToken);
      } catch {
        results.push({
          ...base,
          lineOfficialAccountId: oa.id,
          lineOaName: oa.name,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "MISSING_TOKEN",
          warnings: [],
          estimatedReach: null,
          targetReach: null,
          followerCount: null,
          snapshotDate: null,
        });
        continue;
      }

      const snapshot = oa.followerSnapshots[0] ?? null;
      const targetReach = snapshot?.targetedReaches ?? null;
      const followerCount = snapshot?.followers ?? null;
      const estimatedReach = targetReach ?? followerCount;
      const warnings: string[] = [];

      if (!snapshot) {
        warnings.push("FOLLOWER_SNAPSHOT_MISSING");
      } else {
        const ageMs = Date.now() - snapshot.snapshotDate.getTime();
        if (ageMs > 7 * 24 * 60 * 60 * 1000) warnings.push("FOLLOWER_SNAPSHOT_STALE");
      }

      if (targeting.mode === "FRIENDSHIP_PERIOD") {
        if (targetReach !== null && targetReach < 100) {
          results.push({
            ...base,
            lineOfficialAccountId: oa.id,
            lineOaName: oa.name,
            encryptedChannelAccessToken: oa.encryptedChannelAccessToken,
            isEligible: false,
            skipReason: "TARGET_REACH_BELOW_100",
            warnings,
            estimatedReach,
            targetReach,
            followerCount,
            snapshotDate: snapshot?.snapshotDate.toISOString() ?? null,
          });
          continue;
        }
        if (targetReach === null) warnings.push("TARGET_REACH_UNKNOWN");
      }

      results.push({
        ...base,
        lineOfficialAccountId: oa.id,
        lineOaName: oa.name,
        encryptedChannelAccessToken: oa.encryptedChannelAccessToken,
        isEligible: true,
        skipReason: null,
        warnings,
        estimatedReach,
        targetReach,
        followerCount,
        snapshotDate: snapshot?.snapshotDate.toISOString() ?? null,
      });
    }

    return results;
  }
}
