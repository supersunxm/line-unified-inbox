import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { TikTokService, normalizeTikTokUsernameForMatching } from "./tiktok.service";
import type {
  TikTokStoreOwnerAnalyticsResponse,
  TikTokStoreOwnerStoreResponse,
} from "./dto/tiktok-sync.dto";

const REQUEST_ACTION = "TIKTOK_STORE_BINDING_REQUEST";
const CONFIRMED_ACTION = "TIKTOK_STORE_BINDING_CONFIRMED";
const APPROVED_ACTION = "TIKTOK_STORE_BINDING_APPROVED";
const REJECTED_ACTION = "TIKTOK_STORE_BINDING_REJECTED";

export type TikTokStoreBindingRequestState = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface TikTokBindingStoreSummary {
  id: string;
  externalStoreId: string | null;
  storeName: string;
  accountName: string;
  province: string | null;
  region: string | null;
  tiktokUsername: string | null;
}

interface BindingRequestMetadata {
  accountId: string;
  storeMasterId: string;
  status: TikTokStoreBindingRequestState;
  requestedTikTokUsername?: string | null;
  reviewedByUserId?: string | null;
  reviewedAt?: string | null;
}

function readRequestMetadata(value: unknown): BindingRequestMetadata | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.accountId !== "string" || typeof raw.storeMasterId !== "string") return null;
  const status = raw.status;
  if (status !== "PENDING" && status !== "APPROVED" && status !== "REJECTED" && status !== "CANCELLED") {
    return null;
  }
  return {
    accountId: raw.accountId,
    storeMasterId: raw.storeMasterId,
    status,
    requestedTikTokUsername:
      typeof raw.requestedTikTokUsername === "string" ? raw.requestedTikTokUsername : null,
    reviewedByUserId: typeof raw.reviewedByUserId === "string" ? raw.reviewedByUserId : null,
    reviewedAt: typeof raw.reviewedAt === "string" ? raw.reviewedAt : null,
  };
}

function readSimpleBindingMetadata(value: unknown): { accountId: string; storeMasterId: string } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.accountId !== "string" || typeof raw.storeMasterId !== "string") return null;
  return { accountId: raw.accountId, storeMasterId: raw.storeMasterId };
}

@Injectable()
export class TikTokStoreBindingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tiktokService: TikTokService,
  ) {}

  private storeSelect() {
    return {
      id: true,
      externalStoreId: true,
      storeName: true,
      accountName: true,
      province: true,
      region: true,
      tiktokUsername: true,
    } as const;
  }

  private async getRecentRequestLogs() {
    return this.prisma.auditLog.findMany({
      where: { action: REQUEST_ACTION },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });
  }

  private async findPendingRequestForAccount(accountId: string) {
    const logs = await this.getRecentRequestLogs();
    return (
      logs.find((log) => {
        const metadata = readRequestMetadata(log.metadata);
        return metadata?.accountId === accountId && metadata.status === "PENDING";
      }) || null
    );
  }

  private async isStoreBindingConfirmed(accountId: string, storeMasterId: string): Promise<boolean> {
    const logs = await this.prisma.auditLog.findMany({
      where: { action: { in: [CONFIRMED_ACTION, APPROVED_ACTION] } },
      orderBy: { createdAt: "desc" },
      take: 1000,
    });

    return logs.some((log) => {
      const metadata = readSimpleBindingMetadata(log.metadata);
      return metadata?.accountId === accountId && metadata.storeMasterId === storeMasterId;
    });
  }

  private async findExactStoreByUsername(username?: string | null): Promise<TikTokBindingStoreSummary | null> {
    const normalized = normalizeTikTokUsernameForMatching(username);
    if (!normalized) return null;

    const candidates = await this.prisma.storeMaster.findMany({
      where: {
        isActive: true,
        OR: [
          { tiktokUsername: { equals: normalized, mode: "insensitive" } },
          { tiktokUsername: { equals: `@${normalized}`, mode: "insensitive" } },
        ],
      },
      select: this.storeSelect(),
      take: 5,
    });

    const exactMatches = candidates.filter(
      (store) => normalizeTikTokUsernameForMatching(store.tiktokUsername) === normalized,
    );
    return exactMatches.length === 1 ? exactMatches[0] : null;
  }

  async getBindingContext(accountId: string, query?: string) {
    const account = await this.prisma.tikTokAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        username: true,
        storeMasterId: true,
        storeMaster: { select: this.storeSelect() },
      },
    });
    if (!account) throw new NotFoundException("TikTok account not found");

    const hasConfirmedCurrentStore = Boolean(
      account.storeMaster &&
      (await this.isStoreBindingConfirmed(account.id, account.storeMaster.id)),
    );

    // Existing TikTok sync logic may already have auto-matched storeMasterId by username.
    // Until the user explicitly confirms that match (or HQ approves a manual request),
    // present it as a suggestion rather than a completed store association.
    const currentStore = hasConfirmedCurrentStore ? account.storeMaster : null;
    const suggestedStore = account.storeMaster
      ? hasConfirmedCurrentStore
        ? null
        : account.storeMaster
      : await this.findExactStoreByUsername(account.username);

    const pendingLog = await this.findPendingRequestForAccount(account.id);
    let pendingRequest: null | {
      id: string;
      status: TikTokStoreBindingRequestState;
      requestedAt: string;
      store: TikTokBindingStoreSummary | null;
    } = null;

    if (pendingLog) {
      const metadata = readRequestMetadata(pendingLog.metadata)!;
      const store = await this.prisma.storeMaster.findUnique({
        where: { id: metadata.storeMasterId },
        select: this.storeSelect(),
      });
      pendingRequest = {
        id: pendingLog.id,
        status: metadata.status,
        requestedAt: pendingLog.createdAt.toISOString(),
        store,
      };
    }

    const trimmedQuery = query?.trim() || "";
    const options = await this.prisma.storeMaster.findMany({
      where: {
        isActive: true,
        ...(trimmedQuery
          ? {
              OR: [
                { storeName: { contains: trimmedQuery, mode: "insensitive" as const } },
                { accountName: { contains: trimmedQuery, mode: "insensitive" as const } },
                { externalStoreId: { contains: trimmedQuery, mode: "insensitive" as const } },
                { province: { contains: trimmedQuery, mode: "insensitive" as const } },
                { tiktokUsername: { contains: trimmedQuery.replace(/^@+/, ""), mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: this.storeSelect(),
      orderBy: [{ province: "asc" }, { storeName: "asc" }],
      take: trimmedQuery ? 40 : 20,
    });

    return {
      accountId: account.id,
      username: account.username,
      currentStore,
      suggestedStore,
      pendingRequest,
      options,
    };
  }

  async confirmSuggestedBinding(accountId: string, storeMasterId: string) {
    const [account, store] = await Promise.all([
      this.prisma.tikTokAccount.findUnique({
        where: { id: accountId },
        select: { id: true, username: true, storeMasterId: true },
      }),
      this.prisma.storeMaster.findFirst({
        where: { id: storeMasterId, isActive: true },
        select: this.storeSelect(),
      }),
    ]);

    if (!account) throw new NotFoundException("TikTok account not found");
    if (!store) throw new NotFoundException("Store not found");

    const sameExistingStore = account.storeMasterId === store.id;
    const accountUsername = normalizeTikTokUsernameForMatching(account.username);
    const storeUsername = normalizeTikTokUsernameForMatching(store.tiktokUsername);
    const exactUsernameMatch = Boolean(accountUsername && storeUsername && accountUsername === storeUsername);

    if (!sameExistingStore && !exactUsernameMatch) {
      throw new BadRequestException("Suggested store confirmation requires an exact TikTok username match");
    }

    await this.prisma.$transaction([
      this.prisma.tikTokAccount.update({
        where: { id: account.id },
        data: { storeMasterId: store.id },
      }),
      this.prisma.auditLog.create({
        data: {
          action: CONFIRMED_ACTION,
          metadata: {
            accountId: account.id,
            storeMasterId: store.id,
            tiktokUsername: account.username || null,
            matchType: sameExistingStore ? "EXISTING_BINDING" : "EXACT_USERNAME",
          },
        },
      }),
    ]);

    return { status: "CONNECTED" as const, store };
  }

  async requestStoreBinding(accountId: string, storeMasterId: string) {
    const [account, store] = await Promise.all([
      this.prisma.tikTokAccount.findUnique({
        where: { id: accountId },
        select: { id: true, username: true, storeMasterId: true },
      }),
      this.prisma.storeMaster.findFirst({
        where: { id: storeMasterId, isActive: true },
        select: this.storeSelect(),
      }),
    ]);

    if (!account) throw new NotFoundException("TikTok account not found");
    if (!store) throw new NotFoundException("Store not found");

    if (account.storeMasterId === store.id) {
      const confirmed = await this.isStoreBindingConfirmed(account.id, store.id);
      if (confirmed) {
        return { status: "CONNECTED" as const, store };
      }
      return this.confirmSuggestedBinding(account.id, store.id);
    }

    const logs = await this.getRecentRequestLogs();
    const existingPending = logs.find((log) => {
      const metadata = readRequestMetadata(log.metadata);
      return metadata?.accountId === account.id && metadata.status === "PENDING";
    });

    if (existingPending) {
      const existingMetadata = readRequestMetadata(existingPending.metadata)!;
      if (existingMetadata.storeMasterId === store.id) {
        return {
          status: "PENDING" as const,
          requestId: existingPending.id,
          store,
        };
      }

      await this.prisma.auditLog.update({
        where: { id: existingPending.id },
        data: {
          metadata: {
            ...existingMetadata,
            status: "CANCELLED",
            reviewedAt: new Date().toISOString(),
          },
        },
      });
    }

    const request = await this.prisma.auditLog.create({
      data: {
        action: REQUEST_ACTION,
        metadata: {
          accountId: account.id,
          storeMasterId: store.id,
          status: "PENDING",
          requestedTikTokUsername: account.username || null,
        },
      },
    });

    return { status: "PENDING" as const, requestId: request.id, store };
  }

  /**
   * Returns the exact OAuth-connected account represented by the validated
   * store-owner session. The expected store ID is checked against the current
   * database binding and every non-connected state fails closed without
   * returning analytics.
   */
  async getStoreOwnerAnalytics(
    accountId: string,
    expectedStoreMasterId: string,
  ): Promise<TikTokStoreOwnerAnalyticsResponse> {
    const account = await this.prisma.tikTokAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        storeMasterId: true,
        connectionStatus: true,
        storeMaster: { select: this.storeSelect() },
      },
    });

    if (!account || account.storeMasterId !== expectedStoreMasterId || !account.storeMaster) {
      return { status: "RECONNECT_REQUIRED" };
    }

    if (account.connectionStatus !== "CONNECTED") {
      return { status: "RECONNECT_REQUIRED" };
    }

    const pendingLog = await this.findPendingRequestForAccount(account.id);
    if (pendingLog) {
      const metadata = readRequestMetadata(pendingLog.metadata);
      if (metadata) {
        const pendingStore = await this.prisma.storeMaster.findUnique({
          where: { id: metadata.storeMasterId },
          select: this.storeSelect(),
        });
        return {
          status: "PENDING",
          pendingStore: pendingStore ? this.toStoreOwnerStore(pendingStore) : undefined,
        };
      }
    }

    const isConfirmed = await this.isStoreBindingConfirmed(account.id, account.storeMaster.id);
    const store = this.toStoreOwnerStore(account.storeMaster);
    if (!isConfirmed) {
      return { status: "NEEDS_STORE_CONFIRMATION", store };
    }

    const [overview, historicalMetrics] = await Promise.all([
      this.tiktokService.getTikTokAccountById(account.id),
      this.tiktokService.getAccountHistoricalMetrics(account.id, 30),
    ]);

    if (!overview || !historicalMetrics || overview.storeMasterId !== account.storeMaster.id) {
      return { status: "RECONNECT_REQUIRED" };
    }

    return {
      status: "CONNECTED",
      account: {
        displayName: overview.displayName,
        username: overview.username ?? null,
        avatarUrl: overview.avatarUrl ?? null,
        avatarUrl100: overview.avatarUrl100 ?? null,
        avatarLargeUrl: overview.avatarLargeUrl ?? null,
        bioDescription: overview.bioDescription ?? null,
        isVerified: overview.isVerified,
        followerCount: overview.followerCount,
        followingCount: overview.followingCount,
        likesCount: overview.likesCount,
        videoCount: overview.videoCount,
        connectedAt: overview.connectedAt,
        lastSyncedAt: overview.lastSyncedAt,
        store,
      },
      metrics: {
        summary: historicalMetrics.summary,
        history: historicalMetrics.history,
      },
    };
  }

  private toStoreOwnerStore(store: TikTokBindingStoreSummary): TikTokStoreOwnerStoreResponse {
    return {
      externalStoreId: store.externalStoreId,
      storeName: store.storeName,
      province: store.province,
      region: store.region,
    };
  }

  async listBindingRequests(status: TikTokStoreBindingRequestState = "PENDING") {
    const logs = await this.getRecentRequestLogs();
    const filtered = logs
      .map((log) => ({ log, metadata: readRequestMetadata(log.metadata) }))
      .filter((item) => item.metadata?.status === status);

    const accountIds = [...new Set(filtered.map((item) => item.metadata!.accountId))];
    const storeIds = [...new Set(filtered.map((item) => item.metadata!.storeMasterId))];

    const [accounts, stores] = await Promise.all([
      this.prisma.tikTokAccount.findMany({
        where: { id: { in: accountIds } },
        select: { id: true, username: true, displayName: true, avatarUrl: true, storeMasterId: true },
      }),
      this.prisma.storeMaster.findMany({
        where: { id: { in: storeIds } },
        select: this.storeSelect(),
      }),
    ]);

    const accountMap = new Map(accounts.map((account) => [account.id, account]));
    const storeMap = new Map(stores.map((store) => [store.id, store]));

    return filtered.map(({ log, metadata }) => ({
      id: log.id,
      status: metadata!.status,
      requestedAt: log.createdAt.toISOString(),
      reviewedAt: metadata!.reviewedAt || null,
      reviewedByUserId: metadata!.reviewedByUserId || null,
      account: accountMap.get(metadata!.accountId) || null,
      requestedStore: storeMap.get(metadata!.storeMasterId) || null,
    }));
  }

  async reviewBindingRequest(
    requestId: string,
    decision: "APPROVED" | "REJECTED",
    reviewerUserId?: string | null,
  ) {
    const request = await this.prisma.auditLog.findUnique({ where: { id: requestId } });
    if (!request || request.action !== REQUEST_ACTION) {
      throw new NotFoundException("Store binding request not found");
    }

    const metadata = readRequestMetadata(request.metadata);
    if (!metadata) throw new BadRequestException("Invalid store binding request metadata");
    if (metadata.status !== "PENDING") {
      throw new ConflictException(`Store binding request is already ${metadata.status.toLowerCase()}`);
    }

    const store = await this.prisma.storeMaster.findFirst({
      where: { id: metadata.storeMasterId, isActive: true },
      select: this.storeSelect(),
    });
    if (!store) throw new NotFoundException("Requested store not found");

    const reviewedAt = new Date().toISOString();
    const nextMetadata = {
      ...metadata,
      status: decision,
      reviewedByUserId: reviewerUserId || null,
      reviewedAt,
    };

    if (decision === "APPROVED") {
      await this.prisma.$transaction([
        this.prisma.tikTokAccount.update({
          where: { id: metadata.accountId },
          data: { storeMasterId: metadata.storeMasterId },
        }),
        this.prisma.auditLog.update({
          where: { id: request.id },
          data: { metadata: nextMetadata },
        }),
        this.prisma.auditLog.create({
          data: {
            actorUserId: reviewerUserId || undefined,
            action: APPROVED_ACTION,
            metadata: {
              requestId: request.id,
              accountId: metadata.accountId,
              storeMasterId: metadata.storeMasterId,
            },
          },
        }),
      ]);
    } else {
      await this.prisma.$transaction([
        this.prisma.auditLog.update({
          where: { id: request.id },
          data: { metadata: nextMetadata },
        }),
        this.prisma.auditLog.create({
          data: {
            actorUserId: reviewerUserId || undefined,
            action: REJECTED_ACTION,
            metadata: {
              requestId: request.id,
              accountId: metadata.accountId,
              storeMasterId: metadata.storeMasterId,
            },
          },
        }),
      ]);
    }

    return { status: decision, requestId: request.id, store };
  }
}
