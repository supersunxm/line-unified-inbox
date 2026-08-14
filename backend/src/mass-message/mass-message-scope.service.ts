import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { BmReplyStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { StoreAccessService } from "../auth/store-access.service";
import type { AuthUser } from "../auth/auth.guard";
import {
  MassMessageAudienceType,
  MassMessageStoreMode,
  StoreScopeItem,
  StoreSelectionInput,
} from "./mass-message.types";

@Injectable()
export class MassMessageScopeService {
  private readonly logger = new Logger(MassMessageScopeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: CredentialEncryptionService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  async resolveStoreScope(
    storeSelection: StoreSelectionInput,
    audienceType: MassMessageAudienceType = MassMessageAudienceType.ALL_KNOWN,
    user: AuthUser,
  ): Promise<StoreScopeItem[]> {
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);

    // 1. Resolve candidate store IDs
    let candidateStores: Array<{
      id: string;
      name: string;
      code: string | null;
      isActive: boolean;
      archivedAt: Date | null;
      storeMaster: { externalStoreId: string | null } | null;
      lineOfficialAccounts: Array<{
        id: string;
        name: string;
        isActive: boolean;
        archivedAt: Date | null;
        encryptedChannelAccessToken: string | null;
      }>;
    }>;

    if (storeSelection.mode === MassMessageStoreMode.ALL) {
      candidateStores = await this.prisma.store.findMany({
        where: {
          isActive: true,
          archivedAt: null,
          ...(accessibleStoreIds ? { id: { in: accessibleStoreIds } } : {}),
        },
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
            },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      });
    } else {
      const storeIds = storeSelection.storeIds ?? [];
      if (storeIds.length === 0) {
        throw new BadRequestException("Store selection is empty");
      }
      candidateStores = await this.prisma.store.findMany({
        where: { id: { in: storeIds } },
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
            },
            take: 1,
          },
        },
        orderBy: { name: "asc" },
      });
    }

    const results: StoreScopeItem[] = [];

    for (const store of candidateStores) {
      const masterStoreId = store.storeMaster?.externalStoreId ?? null;
      // Check user authorization for this specific store
      if (accessibleStoreIds && !accessibleStoreIds.includes(store.id)) {
        results.push({
          storeId: store.id,
          masterStoreId,
          externalStoreId: masterStoreId,
          storeName: store.name,
          storeCode: store.code,
          lineOfficialAccountId: null,
          lineOaName: null,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "UNAUTHORIZED",
          recipientUserIds: [],
        });
        continue;
      }

      // Check store active status
      if (!store.isActive || store.archivedAt) {
        results.push({
          storeId: store.id,
          masterStoreId,
          externalStoreId: masterStoreId,
          storeName: store.name,
          storeCode: store.code,
          lineOfficialAccountId: null,
          lineOaName: null,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "STORE_NOT_ACTIVE",
          recipientUserIds: [],
        });
        continue;
      }

      const oa = store.lineOfficialAccounts[0];
      if (!oa || !oa.isActive || oa.archivedAt) {
        results.push({
          storeId: store.id,
          masterStoreId,
          externalStoreId: masterStoreId,
          storeName: store.name,
          storeCode: store.code,
          lineOfficialAccountId: oa?.id ?? null,
          lineOaName: oa?.name ?? null,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "INVALID_CONNECTION",
          recipientUserIds: [],
        });
        continue;
      }

      if (!oa.encryptedChannelAccessToken) {
        results.push({
          storeId: store.id,
          masterStoreId,
          externalStoreId: masterStoreId,
          storeName: store.name,
          storeCode: store.code,
          lineOfficialAccountId: oa.id,
          lineOaName: oa.name,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "MISSING_TOKEN",
          recipientUserIds: [],
        });
        continue;
      }

      // Verify decryptability
      try {
        this.encryption.decrypt(oa.encryptedChannelAccessToken);
      } catch {
        results.push({
          storeId: store.id,
          masterStoreId,
          externalStoreId: masterStoreId,
          storeName: store.name,
          storeCode: store.code,
          lineOfficialAccountId: oa.id,
          lineOaName: oa.name,
          encryptedChannelAccessToken: null,
          isEligible: false,
          skipReason: "MISSING_TOKEN",
          recipientUserIds: [],
        });
        continue;
      }

      // Resolve recipients scoped to this OA and store
      const recipientUserIds = await this.resolveRecipientsForOa(
        oa.id,
        store.id,
        audienceType,
      );

      if (recipientUserIds.length === 0) {
        results.push({
          storeId: store.id,
          masterStoreId,
          externalStoreId: masterStoreId,
          storeName: store.name,
          storeCode: store.code,
          lineOfficialAccountId: oa.id,
          lineOaName: oa.name,
          encryptedChannelAccessToken: oa.encryptedChannelAccessToken,
          isEligible: false,
          skipReason: "NO_RECIPIENTS",
          recipientUserIds: [],
        });
        continue;
      }

      results.push({
        storeId: store.id,
        masterStoreId,
        externalStoreId: masterStoreId,
        storeName: store.name,
        storeCode: store.code,
        lineOfficialAccountId: oa.id,
        lineOaName: oa.name,
        encryptedChannelAccessToken: oa.encryptedChannelAccessToken,
        isEligible: true,
        skipReason: null,
        recipientUserIds,
      });
    }

    return results;
  }

  async resolveRecipientsForOa(
    lineOfficialAccountId: string,
    storeId: string,
    audienceType: MassMessageAudienceType,
  ): Promise<string[]> {
    const whereClause: {
      lineOfficialAccountId: string;
      storeId: string;
      customer: { lineUserId: { not: null } };
      bmReplyStatus?: BmReplyStatus;
    } = {
      lineOfficialAccountId,
      storeId,
      customer: {
        lineUserId: { not: null },
      },
    };

    if (audienceType === MassMessageAudienceType.NOT_REPLIED) {
      whereClause.bmReplyStatus = BmReplyStatus.NOT_REPLIED;
    } else if (audienceType === MassMessageAudienceType.NOTIFIED_BM) {
      whereClause.bmReplyStatus = BmReplyStatus.NOTIFIED_BM;
    } else if (audienceType === MassMessageAudienceType.REPLIED) {
      whereClause.bmReplyStatus = BmReplyStatus.REPLIED;
    }

    const conversations = await this.prisma.conversation.findMany({
      where: whereClause,
      select: {
        customer: {
          select: {
            lineUserId: true,
          },
        },
      },
    });

    const uniqueSet = new Set<string>();
    for (const item of conversations) {
      const uid = item.customer?.lineUserId?.trim();
      if (uid) {
        uniqueSet.add(uid);
      }
    }

    return Array.from(uniqueSet);
  }
}
