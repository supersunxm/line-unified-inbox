import { ConflictException, Injectable } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { PrismaService } from "../prisma.service";

type DbClient = Prisma.TransactionClient | PrismaService | PrismaClient;

export function storeClosedException(storeCode: string | null) {
  return new ConflictException({
    code: "STORE_CLOSED",
    storeCode,
    message: storeCode ? `Store ${storeCode} is closed` : "Store is closed",
  });
}

@Injectable()
export class StoreLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async closeStoreFromMaster(
    client: DbClient,
    identity: { storeMasterId?: string | null; externalStoreId: string },
    closedAt = new Date(),
  ) {
    const stores = await client.store.findMany({
      where: {
        OR: [
          ...(identity.storeMasterId ? [{ storeMasterId: identity.storeMasterId }] : []),
          { code: identity.externalStoreId },
        ],
      },
      select: { id: true, code: true, isActive: true, archivedAt: true },
    });
    let storesClosed = 0;
    let oasArchived = 0;
    let richMenuAttemptsCancelled = 0;
    let backfillJobsBlocked = 0;
    let nicknameJobsBlocked = 0;
    let massMessageDeliveriesBlocked = 0;

    for (const store of stores) {
      const oas = await client.lineOfficialAccount.findMany({
        where: { storeId: store.id, accountType: "STORE" },
        select: { id: true },
      });
      const oaIds = oas.map(({ id }) => id);
      if (oaIds.length > 0) {
        const richMenu = await client.richMenuPublishAttempt.updateMany({
          where: {
            lineOfficialAccountId: { in: oaIds },
            status: { in: ["PENDING", "VALIDATING", "CREATING", "IMAGE_UPLOADING", "SETTING_DEFAULT", "VERIFYING", "ROLLING_BACK"] },
          },
          data: { status: "CANCELLED", completedAt: closedAt, errorCode: "STORE_CLOSED", errorMessage: "Store closed by Store Master lifecycle" },
        });
        richMenuAttemptsCancelled += richMenu.count;
        const backfills = await client.lineOaBackfillJob.updateMany({
          where: { lineOaId: { in: oaIds }, status: { in: ["QUEUED", "RUNNING"] } },
          data: { status: "FAILED", completedAt: closedAt, errorMessage: "STORE_CLOSED" },
        });
        backfillJobsBlocked += backfills.count;
        const nicknames = await client.lineChatNicknameSyncJob.updateMany({
          where: { lineOfficialAccountId: { in: oaIds }, status: { in: ["PENDING", "PROCESSING"] } },
          data: { status: "SUPERSEDED", processedAt: closedAt, lastError: "STORE_CLOSED", workerId: null, claimedAt: null, lockedUntil: null },
        });
        nicknameJobsBlocked += nicknames.count;
      }
      const deliveryIds = (await client.massMessageStoreDelivery.findMany({
        where: { storeId: store.id, status: { in: ["PENDING", "RUNNING"] } },
        select: { id: true },
      })).map(({ id }) => id);
      if (deliveryIds.length > 0) {
        await client.massMessageBatch.updateMany({
          where: { storeDeliveryId: { in: deliveryIds }, status: { in: ["PENDING", "RUNNING"] } },
          data: { status: "FAILED", completedAt: closedAt, errorMessage: "STORE_CLOSED" },
        });
        const deliveries = await client.massMessageStoreDelivery.updateMany({
          where: { id: { in: deliveryIds } },
          data: { status: "SKIPPED", completedAt: closedAt, errorCode: "STORE_CLOSED", errorMessage: "Store closed by Store Master lifecycle" },
        });
        massMessageDeliveriesBlocked += deliveries.count;
      }
      const archived = await client.lineOfficialAccount.updateMany({
        where: { storeId: store.id, accountType: "STORE", isActive: true, archivedAt: null },
        data: { isActive: false, archivedAt: closedAt, connectionStatus: "DISABLED" },
      });
      oasArchived += archived.count;
      const closed = await client.store.updateMany({
        where: { id: store.id, OR: [{ isActive: true }, { archivedAt: null }] },
        data: { isActive: false, archivedAt: store.archivedAt ?? closedAt },
      });
      storesClosed += closed.count;
    }
    return { storesMatched: stores.length, storesClosed, oasArchived, richMenuAttemptsCancelled, backfillJobsBlocked, nicknameJobsBlocked, massMessageDeliveriesBlocked };
  }

  async reopenStoreFromMaster(
    client: DbClient,
    identity: { storeMasterId?: string | null; externalStoreId: string },
  ) {
    const restored = await client.store.updateMany({
      where: {
        AND: [
          { OR: [
            ...(identity.storeMasterId ? [{ storeMasterId: identity.storeMasterId }] : []),
            { code: identity.externalStoreId },
          ] },
          { OR: [{ isActive: false }, { archivedAt: { not: null } }] },
        ],
      },
      data: { isActive: true, archivedAt: null },
    });
    return { storesRestored: restored.count, lineOfficialAccountsRestored: 0 };
  }

  async closeByMasterId(storeMasterId: string) {
    return this.prisma.$transaction(async (tx) => {
      const master = await tx.storeMaster.findUnique({ where: { id: storeMasterId }, select: { id: true, externalStoreId: true, isActive: true } });
      if (!master?.externalStoreId) throw new Error("Store Master canonical Store ID is required");
      if (master.isActive) throw new Error("Store Master is not CLOSED");
      return this.closeStoreFromMaster(tx, { storeMasterId: master.id, externalStoreId: master.externalStoreId });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
