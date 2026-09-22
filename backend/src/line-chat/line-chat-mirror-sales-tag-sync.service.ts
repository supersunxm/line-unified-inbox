import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  ActivityActionType,
  ConversationSourceChannel,
  CustomerSalesStatus,
  LineAccountType,
  PaymentMethodType,
  Prisma,
} from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { buildLineChatNickname } from "../line-chat-nickname";
import { selectLineChatStoreOa } from "./line-chat-store-oa-selector";
import { configuredLineChatMirrorStoreCodes } from "./line-chat-mirror.service";
import {
  ManagerNicknameSalesTag,
  nicknamePeriodDate,
  parseManagerNicknameSalesTag,
} from "./line-chat-manager-nickname-sales-tag";

const DEFAULT_INTERVAL_MS = 300_000;
const MIN_INTERVAL_MS = 60_000;
const DEFAULT_BATCH_SIZE = 500;
const MAX_BATCH_SIZE = 2_000;
const START_DELAY_MS = 20_000;

export type MirrorSalesTagSyncResult = {
  storeCode: string;
  apply: boolean;
  eligible: number;
  mirrorNamesFound: number;
  recognized: number;
  unrecognized: number;
  unresolvedProduct: number;
  ambiguousProduct: number;
  wouldApply: number;
  applied: number;
  raceSkipped: number;
  failed: number;
  durationMs: number;
};

type ProductCandidate = { id: string; name: string };

export function isLineChatMirrorSalesTagSyncEnabled(): boolean {
  return process.env.LINE_CHAT_MIRROR_SALES_TAG_SYNC_ENABLED?.trim().toLowerCase() === "true";
}

export function isLineChatMirrorSalesTagSyncApplyEnabled(): boolean {
  return process.env.LINE_CHAT_MIRROR_SALES_TAG_SYNC_APPLY?.trim().toLowerCase() === "true";
}

export function configuredLineChatMirrorSalesTagStoreCodes(): string[] {
  const raw = process.env.LINE_CHAT_MIRROR_SALES_TAG_SYNC_STORE_CODES?.trim();
  if (!raw) return configuredLineChatMirrorStoreCodes();
  return [...new Set(
    raw
      .split(/[\s,;]+/u)
      .map((value) => value.trim())
      .filter(Boolean),
  )];
}

export function lineChatMirrorSalesTagSyncIntervalMs(): number {
  const raw = Number(process.env.LINE_CHAT_MIRROR_SALES_TAG_SYNC_INTERVAL_MS ?? DEFAULT_INTERVAL_MS);
  if (!Number.isFinite(raw)) return DEFAULT_INTERVAL_MS;
  return Math.max(MIN_INTERVAL_MS, Math.floor(raw));
}

export function lineChatMirrorSalesTagSyncBatchSize(): number {
  const raw = Number(process.env.LINE_CHAT_MIRROR_SALES_TAG_SYNC_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(raw)) return DEFAULT_BATCH_SIZE;
  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(raw)));
}

function isBlankSalesState(conversation: {
  customerSalesStatus: CustomerSalesStatus | null;
  salesRecordedAt: Date | null;
  purchaseRecordedAt: Date | null;
  sourceChannels: ConversationSourceChannel[];
  isInstallment: boolean;
  salesProducts: Array<{ id: string }>;
  products: Array<{ productModelId: string }>;
}): boolean {
  return conversation.customerSalesStatus === null
    && conversation.salesRecordedAt === null
    && conversation.purchaseRecordedAt === null
    && conversation.sourceChannels.length === 0
    && conversation.isInstallment === false
    && conversation.salesProducts.length === 0
    && conversation.products.length === 0;
}

function paymentMethodEnum(tag: Extract<ManagerNicknameSalesTag, { status: "PURCHASED" }>): PaymentMethodType {
  switch (tag.paymentMethod) {
    case "CASH": return PaymentMethodType.CASH;
    case "UFUND": return PaymentMethodType.UFUND;
    case "SG_FINANCE": return PaymentMethodType.SG_FINANCE;
    default: return PaymentMethodType.INSTALLMENT;
  }
}

function findProductForPurchasedNickname(
  displayName: string,
  tag: Extract<ManagerNicknameSalesTag, { status: "PURCHASED" }>,
  products: ProductCandidate[],
): { status: "MATCHED"; product: ProductCandidate }
  | { status: "UNRESOLVED" }
  | { status: "AMBIGUOUS" } {
  const recordedAt = nicknamePeriodDate(tag.period);
  const matches = products.filter((product) => buildLineChatNickname({
    status: "PURCHASED",
    paymentMethod: tag.paymentMethod,
    recordedAt,
    products: [{ model: { name: product.name } }],
  }) === displayName);

  if (matches.length === 1) return { status: "MATCHED", product: matches[0] };
  if (matches.length > 1) return { status: "AMBIGUOUS" };
  return { status: "UNRESOLVED" };
}

@Injectable()
export class LineChatMirrorSalesTagSyncService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatMirrorSalesTagSyncService.name);
  private timer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === "test"
      || !isLineChatMirrorSalesTagSyncEnabled()
      || configuredLineChatMirrorSalesTagStoreCodes().length === 0
    ) {
      return;
    }

    const intervalMs = lineChatMirrorSalesTagSyncIntervalMs();
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_sales_tag_sync_started",
      storeCount: configuredLineChatMirrorSalesTagStoreCodes().length,
      apply: isLineChatMirrorSalesTagSyncApplyEnabled(),
      intervalMs,
      batchSize: lineChatMirrorSalesTagSyncBatchSize(),
      policy: "ONLY_BLANK_SALES_STATE",
    }));

    this.startupTimer = setTimeout(() => void this.runCycle(), START_DELAY_MS);
    this.startupTimer.unref?.();
    this.timer = setInterval(() => void this.runCycle(), intervalMs);
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    if (this.startupTimer) clearTimeout(this.startupTimer);
    this.timer = null;
    this.startupTimer = null;
  }

  public async runCycle(): Promise<MirrorSalesTagSyncResult[]> {
    if (this.running) return [];
    this.running = true;
    try {
      const products = await this.prisma.productModel.findMany({
        where: {
          isActive: true,
          classificationLevel: "MODEL",
          productSeries: { isActive: true },
        },
        orderBy: [{ priority: "desc" }, { name: "asc" }, { id: "asc" }],
        select: { id: true, name: true },
      });

      const results: MirrorSalesTagSyncResult[] = [];
      for (const storeCode of configuredLineChatMirrorSalesTagStoreCodes()) {
        try {
          results.push(await this.syncStore(storeCode, products));
        } catch (error) {
          this.logger.error(JSON.stringify({
            event: "line_chat_mirror_sales_tag_sync_store_failed",
            storeCode,
            error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
          }));
        }
      }
      return results;
    } finally {
      this.running = false;
    }
  }

  private async syncStore(
    storeCode: string,
    products: ProductCandidate[],
  ): Promise<MirrorSalesTagSyncResult> {
    const startedAt = Date.now();
    const apply = isLineChatMirrorSalesTagSyncApplyEnabled();
    const store = await this.prisma.store.findFirst({
      where: {
        isActive: true,
        archivedAt: null,
        OR: [
          { code: storeCode },
          { storeMaster: { externalStoreId: storeCode } },
        ],
      },
      select: {
        id: true,
        code: true,
        storeMaster: {
          select: {
            externalStoreId: true,
            accountName: true,
            normalizedAccountName: true,
            lineId: true,
          },
        },
        lineOfficialAccounts: {
          where: {
            accountType: LineAccountType.STORE,
            isActive: true,
            archivedAt: null,
          },
          orderBy: { updatedAt: "desc" },
          select: { id: true, name: true, basicId: true },
        },
      },
    });
    if (!store) throw new Error("SALES_TAG_SYNC_STORE_NOT_FOUND");

    const oaSelection = selectLineChatStoreOa(
      store.storeMaster,
      store.lineOfficialAccounts.map((candidate) => ({
        id: candidate.id,
        name: candidate.name,
        basicId: candidate.basicId,
      })),
    );
    if (!oaSelection.ok) {
      throw new Error(`SALES_TAG_SYNC_OA_IDENTITY_${oaSelection.reason}`);
    }
    const oa = store.lineOfficialAccounts.find((candidate) => candidate.id === oaSelection.oaId);
    if (!oa) throw new Error("SALES_TAG_SYNC_SELECTED_OA_NOT_FOUND");

    const effectiveStoreCode = store.code?.trim()
      || store.storeMaster?.externalStoreId?.trim()
      || storeCode;

    const eligible = await this.prisma.conversation.findMany({
      where: {
        storeId: store.id,
        lineOfficialAccountId: oa.id,
        lineChatUserId: { not: null },
        customerSalesStatus: null,
        salesRecordedAt: null,
        purchaseRecordedAt: null,
        sourceChannels: { isEmpty: true },
        isInstallment: false,
        salesProducts: { none: {} },
        products: { none: { source: "MANUAL" } },
      },
      orderBy: [{ latestMessageAt: "desc" }, { id: "asc" }],
      take: lineChatMirrorSalesTagSyncBatchSize(),
      select: {
        id: true,
        lineChatUserId: true,
      },
    });

    const lineChatUserIds = eligible
      .map((conversation) => conversation.lineChatUserId?.trim())
      .filter((value): value is string => Boolean(value));

    const mirrorChats = lineChatUserIds.length === 0
      ? []
      : await this.prisma.lineChatMirrorChat.findMany({
          where: {
            lineOfficialAccountId: oa.id,
            lineChatUserId: { in: lineChatUserIds },
            displayName: { not: null },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          select: {
            lineChatUserId: true,
            displayName: true,
            updatedAt: true,
          },
        });
    const mirrorByUserId = new Map(
      mirrorChats.map((chat) => [chat.lineChatUserId, chat]),
    );

    const result: MirrorSalesTagSyncResult = {
      storeCode: effectiveStoreCode,
      apply,
      eligible: eligible.length,
      mirrorNamesFound: mirrorChats.length,
      recognized: 0,
      unrecognized: 0,
      unresolvedProduct: 0,
      ambiguousProduct: 0,
      wouldApply: 0,
      applied: 0,
      raceSkipped: 0,
      failed: 0,
      durationMs: 0,
    };

    for (const conversation of eligible) {
      const managerId = conversation.lineChatUserId?.trim();
      if (!managerId) continue;
      const mirror = mirrorByUserId.get(managerId);
      const displayName = mirror?.displayName?.trim();
      if (!displayName) continue;

      const tag = parseManagerNicknameSalesTag(displayName);
      if (!tag) {
        result.unrecognized += 1;
        continue;
      }
      result.recognized += 1;

      let product: ProductCandidate | null = null;
      if (tag.status === "PURCHASED") {
        const resolution = findProductForPurchasedNickname(displayName, tag, products);
        if (resolution.status === "UNRESOLVED") {
          result.unresolvedProduct += 1;
          continue;
        }
        if (resolution.status === "AMBIGUOUS") {
          result.ambiguousProduct += 1;
          continue;
        }
        product = resolution.product;
      }

      result.wouldApply += 1;
      if (!apply) continue;

      try {
        const applied = await this.applyTag({
          conversationId: conversation.id,
          displayName,
          tag,
          product,
          observedAt: mirror?.updatedAt ?? new Date(),
        });
        if (applied) result.applied += 1;
        else result.raceSkipped += 1;
      } catch (error) {
        result.failed += 1;
        this.logger.warn(JSON.stringify({
          event: "line_chat_mirror_sales_tag_sync_apply_failed",
          storeCode: effectiveStoreCode,
          conversationId: conversation.id,
          status: tag.status,
          error: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500),
        }));
      }
    }

    result.durationMs = Date.now() - startedAt;
    this.logger.log(JSON.stringify({
      event: "line_chat_mirror_sales_tag_sync_store_completed",
      ...result,
    }));
    return result;
  }

  private async applyTag(input: {
    conversationId: string;
    displayName: string;
    tag: ManagerNicknameSalesTag;
    product: ProductCandidate | null;
    observedAt: Date;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.conversation.findUnique({
        where: { id: input.conversationId },
        select: {
          customerSalesStatus: true,
          salesRecordedAt: true,
          purchaseRecordedAt: true,
          sourceChannels: true,
          isInstallment: true,
          salesProducts: { select: { id: true } },
          products: {
            where: { source: "MANUAL" },
            select: { productModelId: true },
          },
        },
      });
      if (!current || !isBlankSalesState(current)) return false;

      const common: Prisma.ConversationUpdateInput = {
        interestLevel: null,
      };
      let actionType = ActivityActionType.CUSTOMER_SALES_INFO_UPDATED;
      let productModelId: string | null = null;

      if (input.tag.status === "ONLINE") {
        Object.assign(common, {
          customerSalesStatus: CustomerSalesStatus.ONLINE,
          onlineSource: input.tag.onlineSource,
          filmBrand: null,
          sourceChannels: { set: [] },
          paymentMethod: null,
          isInstallment: false,
        } satisfies Prisma.ConversationUpdateInput);
      } else if (input.tag.status === "FILM") {
        Object.assign(common, {
          customerSalesStatus: CustomerSalesStatus.FILM,
          filmBrand: input.tag.filmBrand,
          onlineSource: null,
          sourceChannels: { set: [] },
          paymentMethod: null,
          isInstallment: false,
        } satisfies Prisma.ConversationUpdateInput);
      } else {
        if (!input.product) return false;
        const paymentMethod = paymentMethodEnum(input.tag);
        productModelId = input.product.id;
        actionType = ActivityActionType.PURCHASE_INFORMATION_UPDATED;
        Object.assign(common, {
          customerSalesStatus: CustomerSalesStatus.PURCHASED,
          filmBrand: null,
          onlineSource: null,
          sourceChannels: { set: [ConversationSourceChannel.STORE] },
          paymentMethod,
          isInstallment: paymentMethod === PaymentMethodType.INSTALLMENT,
        } satisfies Prisma.ConversationUpdateInput);
      }

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: common,
      });

      if (input.tag.status === "PURCHASED" && input.product) {
        await tx.conversationSalesProduct.create({
          data: {
            conversationId: input.conversationId,
            productModelId: input.product.id,
            quantity: 1,
            status: CustomerSalesStatus.PURCHASED,
          },
        });
        const existingProduct = await tx.conversationProduct.findUnique({
          where: {
            conversationId_productModelId: {
              conversationId: input.conversationId,
              productModelId: input.product.id,
            },
          },
          select: { conversationId: true },
        });
        if (!existingProduct) {
          await tx.conversationProduct.create({
            data: {
              conversationId: input.conversationId,
              productModelId: input.product.id,
              source: "MANAGER_NICKNAME_IMPORT",
              confidence: 1,
              matchedPhrase: input.displayName,
              detectionMethod: "MANAGER_NICKNAME",
            },
          });
        }
      }

      await tx.activityHistory.create({
        data: {
          conversationId: input.conversationId,
          actionType,
          createdByUserId: null,
          createdByName: "Project B Mirror Tag Sync",
          description: "Customer sales tag imported from LINE OA Manager nickname",
          metadata: {
            source: "PROJECT_B_MANAGER_NICKNAME",
            managerDisplayName: input.displayName,
            parsedStatus: input.tag.status,
            encodedPeriod: input.tag.period
              ? `${String(input.tag.period.month).padStart(2, "0")}/${String(input.tag.period.year).slice(-2)}`
              : null,
            productModelId,
            observedAt: input.observedAt.toISOString(),
            approximation: input.tag.status === "PURCHASED" && input.tag.paymentMethod === "INSTALLMENT"
              ? "ผ่อน cannot distinguish installment from credit card; normalized to INSTALLMENT"
              : null,
          },
        },
      });

      return true;
    });
  }
}
