import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthUser } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";
import { PrismaService } from "./prisma.service";
import { PurchaseAnalyticsQueryDto } from "./purchase-analytics.dto";

type PurchaseAnalyticsRow = {
  id: string;
  purchaseRecordedAt: Date | null;
  sourceChannels: string[];
  isInstallment: boolean;
  store: { id: string; name: string; code: string | null };
  purchaseRecordedBy: { id: string; displayName: string } | null;
  products: Array<{
    source: string | null;
    productModel: { id: string; name: string; productSeries: { name: string } };
    productVariant: { id: string; ram: string | null; rom: string | null; color: string | null } | null;
  }>;
};

type PurchaseAudienceRecord = {
  id: string;
  customerId: string;
  latestMessageAt: Date;
  purchaseRecordedAt: Date | null;
  customerSalesStatus: string | null;
  sourceChannels: string[];
  paymentMethod: string | null;
  customer: {
    id: string;
    lineUserId: string | null;
    displayName: string;
    preferredLanguage: string | null;
  };
  store: { id: string; name: string; code: string | null };
  lineOfficialAccount: {
    id: string;
    name: string;
    basicId: string | null;
    connectionStatus: string;
    isActive: boolean;
    archivedAt: Date | null;
  };
  purchaseRecordedBy: { id: string; displayName: string } | null;
  salesProducts: Array<{
    customProductName: string | null;
    quantity: number;
    productModel: { id: string; name: string; productSeries: { name: string } };
    productVariant: { id: string; ram: string | null; rom: string | null; color: string | null } | null;
  }>;
};

type AudienceProduct = {
  modelId: string;
  modelName: string;
  seriesName: string;
  variantId: string | null;
  ram: string | null;
  rom: string | null;
  color: string | null;
  customProductName: string | null;
  quantity: number;
};

type DateRange = { from?: Date; to?: Date };
const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseDate(value: string | undefined, field: "from" | "to") {
  if (!value) return undefined;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const parsedDate = new Date(Date.UTC(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3])) - BANGKOK_OFFSET_MS);
    if (Number.isNaN(parsedDate.getTime())) throw new BadRequestException(`${field} must be a valid ISO date`);
    return parsedDate;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new BadRequestException(`${field} must be a valid ISO date`);
  return parsed;
}

function dateRange(query: PurchaseAnalyticsQueryDto): DateRange {
  const from = parseDate(query.from, "from");
  let to = parseDate(query.to, "to");
  // Date-only boundaries use the product's Asia/Bangkok reporting day and are
  // represented as a half-open range in SQL.
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(query.to ?? "")) {
    to = new Date(to.getTime() + 24 * 60 * 60 * 1000);
  }
  if (from && to && from >= to) throw new BadRequestException("from must be before to");
  return { from, to };
}

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function ranking(map: Map<string, number>) {
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function audienceMessageability(row: PurchaseAudienceRecord) {
  if (!row.customer.lineUserId) return { canMessage: false, excludeReason: "MISSING_LINE_USER_ID" as const };
  if (!row.lineOfficialAccount.isActive || row.lineOfficialAccount.archivedAt) {
    return { canMessage: false, excludeReason: "LINE_OA_INACTIVE" as const };
  }
  if (!["CONNECTED", "READY"].includes(row.lineOfficialAccount.connectionStatus)) {
    return { canMessage: false, excludeReason: "LINE_OA_NOT_READY" as const };
  }
  return { canMessage: true, excludeReason: null };
}

function audienceProductKey(product: AudienceProduct) {
  return [product.modelId, product.variantId ?? "", product.customProductName ?? ""].join(":");
}

@Injectable()
export class PurchaseAnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly storeAccess: StoreAccessService) {}

  private async scope(user: AuthUser, query: PurchaseAnalyticsQueryDto) {
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    if (query.storeId && accessibleStoreIds !== null && !accessibleStoreIds.includes(query.storeId)) {
      throw new ForbiddenException("Store access is forbidden");
    }
    const range = dateRange(query);
    const purchaseRecordedAt: Prisma.DateTimeNullableFilter = {
      not: null,
      ...(range.from ? { gte: range.from } : {}),
      ...(range.to ? { lt: range.to } : {}),
    };
    const where: Prisma.ConversationWhereInput = {
      isQa: false,
      store: { isActive: true, archivedAt: null },
      purchaseRecordedAt,
      ...(accessibleStoreIds === null ? {} : { storeId: { in: accessibleStoreIds } }),
      ...(query.storeId ? { storeId: query.storeId } : {}),
    };
    return { where };
  }

  async get(user: AuthUser, query: PurchaseAnalyticsQueryDto = new PurchaseAnalyticsQueryDto()) {
    const { where } = await this.scope(user, query);
    const rows = (await this.prisma.conversation.findMany({
      where,
      orderBy: [{ purchaseRecordedAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        purchaseRecordedAt: true,
        sourceChannels: true,
        isInstallment: true,
        store: { select: { id: true, name: true, code: true } },
        purchaseRecordedBy: { select: { id: true, displayName: true } },
        products: {
          where: { source: "MANUAL" },
          select: {
            source: true,
            productModel: { select: { id: true, name: true, productSeries: { select: { name: true } } } },
            productVariant: { select: { id: true, ram: true, rom: true, color: true } },
          },
        },
      },
    }) as PurchaseAnalyticsRow[]).filter((row): row is PurchaseAnalyticsRow & { purchaseRecordedAt: Date } => row.purchaseRecordedAt instanceof Date);

    const products = new Map<string, { name: string; seriesName: string; count: number }>();
    const variants = new Map<string, { modelName: string; variant: string; color: string | null; count: number }>();
    const colors = new Map<string, number>();
    const channels = new Map<string, number>();
    const paymentMethods = new Map<string, number>();
    const stores = new Map<string, { storeName: string; storeCode: string | null; count: number; conversations: Set<string> }>();
    const recordingActivity = new Map<string, { displayName: string; count: number; lastRecordedAt: Date }>();

    for (const row of rows) {
      const store = stores.get(row.store.id) ?? { storeName: row.store.name, storeCode: row.store.code, count: 0, conversations: new Set<string>() };
      store.count++;
      store.conversations.add(row.id);
      stores.set(row.store.id, store);

      const recorderKey = row.purchaseRecordedBy?.id ?? "UNKNOWN";
      const recorder = recordingActivity.get(recorderKey);
      if (recorder) {
        recorder.count++;
        if (row.purchaseRecordedAt > recorder.lastRecordedAt) recorder.lastRecordedAt = row.purchaseRecordedAt;
      } else {
        recordingActivity.set(recorderKey, { displayName: row.purchaseRecordedBy?.displayName ?? "Unknown recorder", count: 1, lastRecordedAt: row.purchaseRecordedAt });
      }

      const rowChannels = row.sourceChannels.length > 0 ? row.sourceChannels : ["UNSPECIFIED"];
      for (const channel of rowChannels) increment(channels, channel);
      increment(paymentMethods, row.isInstallment ? "INSTALLMENT" : "UNSPECIFIED");

      const manualProducts = row.products.filter((product) => product.source === "MANUAL");
      for (const product of manualProducts) {
        const existingProduct = products.get(product.productModel.id);
        if (existingProduct) existingProduct.count++;
        else products.set(product.productModel.id, { name: product.productModel.name, seriesName: product.productModel.productSeries.name, count: 1 });
        const variant = product.productVariant;
        if (!variant) continue;
        const variantKey = variant.id;
        const variantLabel = [variant.ram, variant.rom].filter(Boolean).join(" / ") || variant.id;
        const existingVariant = variants.get(variantKey);
        if (existingVariant) existingVariant.count++;
        else variants.set(variantKey, { modelName: product.productModel.name, variant: variantLabel, color: variant.color, count: 1 });
        if (variant.color) increment(colors, variant.color);
      }
    }

    return {
      filters: { from: query.from ?? null, to: query.to ?? null, storeId: query.storeId ?? null },
      overview: {
        verifiedPurchaseRecords: rows.length,
        recordedProducts: rows.reduce((sum, row) => sum + row.products.filter((product) => product.source === "MANUAL").length, 0),
        stores: stores.size,
        recordingBms: [...recordingActivity.keys()].filter((key) => key !== "UNKNOWN").length,
      },
      products: [...products.entries()].map(([productModelId, value]) => ({ productModelId, ...value })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
      variants: [...variants.entries()].map(([productVariantId, value]) => ({ productVariantId, ...value })).sort((a, b) => b.count - a.count || a.modelName.localeCompare(b.modelName)),
      colors: ranking(colors),
      channels: ranking(channels),
      paymentMethods: ranking(paymentMethods),
      stores: [...stores.entries()].map(([storeId, value]) => ({ storeId, storeName: value.storeName, storeCode: value.storeCode, recordCount: value.count, uniqueConversations: value.conversations.size })).sort((a, b) => b.recordCount - a.recordCount || a.storeName.localeCompare(b.storeName)),
      recordingActivity: [...recordingActivity.entries()].map(([userId, value]) => ({ userId: userId === "UNKNOWN" ? null : userId, displayName: value.displayName, recordCount: value.count, lastRecordedAt: value.lastRecordedAt.toISOString() })).sort((a, b) => b.recordCount - a.recordCount || a.displayName.localeCompare(b.displayName)),
    };
  }

  async getAudience(user: AuthUser, query: PurchaseAnalyticsQueryDto = new PurchaseAnalyticsQueryDto()) {
    const { where } = await this.scope(user, query);
    const rows = (await this.prisma.conversation.findMany({
      where,
      orderBy: [{ purchaseRecordedAt: "desc" }, { latestMessageAt: "desc" }, { id: "asc" }],
      select: {
        id: true,
        customerId: true,
        latestMessageAt: true,
        purchaseRecordedAt: true,
        customerSalesStatus: true,
        sourceChannels: true,
        paymentMethod: true,
        customer: { select: { id: true, lineUserId: true, displayName: true, preferredLanguage: true } },
        store: { select: { id: true, name: true, code: true } },
        lineOfficialAccount: { select: { id: true, name: true, basicId: true, connectionStatus: true, isActive: true, archivedAt: true } },
        purchaseRecordedBy: { select: { id: true, displayName: true } },
        salesProducts: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            customProductName: true,
            quantity: true,
            productModel: { select: { id: true, name: true, productSeries: { select: { name: true } } } },
            productVariant: { select: { id: true, ram: true, rom: true, color: true } },
          },
        },
      },
    }) as PurchaseAudienceRecord[]).filter((row): row is PurchaseAudienceRecord & { purchaseRecordedAt: Date } => row.purchaseRecordedAt instanceof Date);

    const customers = new Map<string, {
      customerId: string;
      customerName: string;
      lineUserId: string | null;
      preferredLanguage: string | null;
      conversationId: string;
      lineOaId: string;
      lineOaName: string;
      lineOaBasicId: string | null;
      storeId: string;
      storeName: string;
      storeCode: string | null;
      customerStatus: string | null;
      purchaseChannels: Set<string>;
      paymentMethods: Set<string>;
      products: Map<string, AudienceProduct>;
      recordedById: string | null;
      recordedByName: string | null;
      lastPurchaseAt: Date;
      lastMessageAt: Date;
      canMessage: boolean;
      excludeReason: string | null;
    }>();

    for (const row of rows) {
      const messageability = audienceMessageability(row);
      const key = row.customer.id;
      const mappedProducts: AudienceProduct[] = row.salesProducts.map((product) => ({
        modelId: product.productModel.id,
        modelName: product.productModel.name,
        seriesName: product.productModel.productSeries.name,
        variantId: product.productVariant?.id ?? null,
        ram: product.productVariant?.ram ?? null,
        rom: product.productVariant?.rom ?? null,
        color: product.productVariant?.color ?? null,
        customProductName: product.customProductName,
        quantity: product.quantity,
      }));
      const existing = customers.get(key);
      if (!existing) {
        customers.set(key, {
          customerId: row.customer.id,
          customerName: row.customer.displayName,
          lineUserId: row.customer.lineUserId,
          preferredLanguage: row.customer.preferredLanguage,
          conversationId: row.id,
          lineOaId: row.lineOfficialAccount.id,
          lineOaName: row.lineOfficialAccount.name,
          lineOaBasicId: row.lineOfficialAccount.basicId,
          storeId: row.store.id,
          storeName: row.store.name,
          storeCode: row.store.code,
          customerStatus: row.customerSalesStatus,
          purchaseChannels: new Set(row.sourceChannels),
          paymentMethods: new Set(row.paymentMethod ? [row.paymentMethod] : []),
          products: new Map(mappedProducts.map((product) => [audienceProductKey(product), product])),
          recordedById: row.purchaseRecordedBy?.id ?? null,
          recordedByName: row.purchaseRecordedBy?.displayName ?? null,
          lastPurchaseAt: row.purchaseRecordedAt,
          lastMessageAt: row.latestMessageAt,
          canMessage: messageability.canMessage,
          excludeReason: messageability.excludeReason,
        });
        continue;
      }
      for (const channel of row.sourceChannels) existing.purchaseChannels.add(channel);
      if (row.paymentMethod) existing.paymentMethods.add(row.paymentMethod);
      for (const product of mappedProducts) {
        const productKey = audienceProductKey(product);
        const current = existing.products.get(productKey);
        if (current) current.quantity += product.quantity;
        else existing.products.set(productKey, product);
      }
      if (row.purchaseRecordedAt > existing.lastPurchaseAt) {
        existing.conversationId = row.id;
        existing.lineOaId = row.lineOfficialAccount.id;
        existing.lineOaName = row.lineOfficialAccount.name;
        existing.lineOaBasicId = row.lineOfficialAccount.basicId;
        existing.storeId = row.store.id;
        existing.storeName = row.store.name;
        existing.storeCode = row.store.code;
        existing.customerStatus = row.customerSalesStatus;
        existing.recordedById = row.purchaseRecordedBy?.id ?? null;
        existing.recordedByName = row.purchaseRecordedBy?.displayName ?? null;
        existing.lastPurchaseAt = row.purchaseRecordedAt;
        existing.canMessage = messageability.canMessage;
        existing.excludeReason = messageability.excludeReason;
      }
      if (row.latestMessageAt > existing.lastMessageAt) existing.lastMessageAt = row.latestMessageAt;
    }

    const audience = [...customers.values()]
      .map((item) => ({
        customerId: item.customerId,
        customerName: item.customerName,
        lineUserId: item.lineUserId,
        preferredLanguage: item.preferredLanguage,
        conversationId: item.conversationId,
        lineOaId: item.lineOaId,
        lineOaName: item.lineOaName,
        lineOaBasicId: item.lineOaBasicId,
        storeId: item.storeId,
        storeName: item.storeName,
        storeCode: item.storeCode,
        customerStatus: item.customerStatus,
        purchaseChannels: [...item.purchaseChannels].sort(),
        paymentMethods: [...item.paymentMethods].sort(),
        products: [...item.products.values()].sort((a, b) => a.modelName.localeCompare(b.modelName)),
        recordedById: item.recordedById,
        recordedByName: item.recordedByName,
        lastPurchaseAt: item.lastPurchaseAt.toISOString(),
        lastMessageAt: item.lastMessageAt.toISOString(),
        canMessage: item.canMessage,
        excludeReason: item.excludeReason,
      }))
      .sort((a, b) => b.lastPurchaseAt.localeCompare(a.lastPurchaseAt) || a.customerName.localeCompare(b.customerName));

    return {
      filters: { from: query.from ?? null, to: query.to ?? null, storeId: query.storeId ?? null },
      summary: {
        customers: audience.length,
        messageableCustomers: audience.filter((item) => item.canMessage).length,
        excludedCustomers: audience.filter((item) => !item.canMessage).length,
      },
      messageabilityDefinition: "LINE_USER_ID_AND_ACTIVE_READY_OA",
      audience,
    };
  }
}
