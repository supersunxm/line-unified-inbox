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

@Injectable()
export class PurchaseAnalyticsService {
  constructor(private readonly prisma: PrismaService, private readonly storeAccess: StoreAccessService) {}

  async get(user: AuthUser, query: PurchaseAnalyticsQueryDto = new PurchaseAnalyticsQueryDto()) {
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
      // A provenance timestamp without a manual product/channel is still a valid
      // recorded information snapshot, so the query intentionally does not require
      // a product row. RULE rows are filtered from the selected relation below.
    };
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
}
