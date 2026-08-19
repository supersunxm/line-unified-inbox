/**
 * Shared semantic projection for conversation consumers.
 *
 * The database keeps the legacy names for compatibility. This projection
 * makes the business meaning explicit at the API boundary:
 * manual records are purchase information and rule records are insights.
 */
export type ConversationContractProduct = {
  source?: string | null;
  confidence?: number | null;
  matchedPhrase?: string | null;
  detectionMethod?: string | null;
  sourceMessageId?: string | null;
  productModel?: {
    id: string;
    name: string;
    productSeries?: { name: string; productGroup?: string | null } | null;
  } | null;
  productVariant?: {
    id: string;
    ram: string | null;
    rom: string | null;
    color: string | null;
  } | null;
};

export type ConversationContractTopic = {
  source?: string | null;
  confidence?: number | null;
  topic?: { id: string; name: string; category: string } | null;
};

export type ConversationContractSalesProduct = {
  id?: string;
  quantity?: number;
  status?: string;
  customProductName?: string | null;
  ram?: string | null;
  rom?: string | null;
  color?: string | null;
  productModelId?: string;
  productVariantId?: string | null;
  productModel?: {
    id: string;
    name: string;
    productSeries?: { name: string; productGroup?: string | null } | null;
  } | null;
  productVariant?: {
    id: string;
    ram: string | null;
    rom: string | null;
    color: string | null;
  } | null;
};

export type CustomerSalesInformationContract = {
  status: "INTERESTED" | "PURCHASED" | null;
  interestLevel: "HOT" | "WARM" | "COLD" | null;
  purchaseChannel: string[];
  paymentMethod: "CASH" | "INSTALLMENT" | "CREDIT_CARD" | "OTHER" | null;
  products: Array<{
    id: string;
    productModelId: string;
    productVariantId: string | null;
    model: { id: string; name: string; seriesName: string | null; category: string | null };
    variant: { id: string; ram: string | null; rom: string | null; color: string | null } | null;
    customProductName: string | null;
    ram: string | null;
    rom: string | null;
    color: string | null;
    quantity: number;
    status: "INTERESTED" | "PURCHASED";
  }>;
  recordedBy: string | null;
  recordedAt: string | null;
};

export type PurchaseInformationContract = {
  /**
   * VERIFIED is backed by a BM save with provenance. LEGACY_MANUAL keeps
   * historical manual rows visible as an explicit, unverified state, while
   * NONE means there is no manual purchase record.
   */
  recordState: "VERIFIED" | "LEGACY_MANUAL" | "NONE";
  purchaseChannel: string[];
  paymentMethod: "INSTALLMENT" | null;
  products: Array<{
    model: { id: string; name: string; seriesName: string | null; category: string | null };
    variant: { id: string; ram: string | null; rom: string | null; color: string | null } | null;
    source: "MANUAL";
  }>;
  recordedBy: string | null;
  recordedAt: string | null;
};

export type AiInsightContract = {
  mentionedProducts: Array<{
    model: { id: string; name: string; seriesName: string | null; category: string | null };
    variant: { id: string; ram: string | null; rom: string | null; color: string | null } | null;
    confidence: number | null;
    matchedPhrase: string | null;
    detectionMethod: string | null;
    sourceMessageId: string | null;
  }>;
  topics: Array<{
    id: string;
    name: string;
    category: string;
    confidence: number | null;
  }>;
  classification: {
    productRelationship: string | null;
    purchaseIntent: string | null;
  };
};

export type OperationalStateContract = {
  replyStatus: string;
  priority: { level: string };
  unread: number | null;
};

export function buildCustomerSalesInformation(input: {
  customerSalesStatus?: string | null;
  interestLevel?: string | null;
  sourceChannels?: readonly string[] | null;
  paymentMethod?: string | null;
  isInstallment?: boolean | null;
  salesProducts?: readonly ConversationContractSalesProduct[] | null;
  products?: readonly ConversationContractProduct[] | null;
  salesRecordedBy?: { displayName?: string | null } | null;
  salesRecordedAt?: Date | string | null;
  purchaseRecordedBy?: { displayName?: string | null } | null;
  purchaseRecordedAt?: Date | string | null;
}): CustomerSalesInformationContract {
  // A salesRecordedAt value means the conversation has entered the modern
  // Customer Sales Info state model. From that point onward an explicit null
  // customerSalesStatus is authoritative and must not be resurrected as
  // PURCHASED by legacy purchase provenance. The legacy fallback remains for
  // historical records that predate the modern sales state.
  const hasModernSalesRecord = input.salesRecordedAt != null;
  const hasLegacyPurchaseSignal =
    input.purchaseRecordedAt != null ||
    input.isInstallment === true ||
    (input.sourceChannels?.length ?? 0) > 0;
  const status =
    (input.customerSalesStatus as "INTERESTED" | "PURCHASED" | null | undefined) ??
    (!hasModernSalesRecord && hasLegacyPurchaseSignal ? "PURCHASED" : null);

  const interestLevel = (input.interestLevel as "HOT" | "WARM" | "COLD") || null;
  const purchaseChannel = status === "PURCHASED" ? [...(input.sourceChannels ?? [])] : [];
  const paymentMethod = (input.paymentMethod as "CASH" | "INSTALLMENT" | "CREDIT_CARD" | "OTHER") ||
    (status === "PURCHASED" && input.isInstallment ? "INSTALLMENT" : null);

  const rawRecordedAt = input.salesRecordedAt ?? input.purchaseRecordedAt;
  const recordedAt = rawRecordedAt
    ? rawRecordedAt instanceof Date
      ? rawRecordedAt
      : new Date(rawRecordedAt)
    : null;
  const recordedBy = (input.salesRecordedBy ?? input.purchaseRecordedBy)?.displayName?.trim() || null;

  let productsList: CustomerSalesInformationContract["products"] = [];

  if (input.salesProducts && input.salesProducts.length > 0) {
    productsList = input.salesProducts
      .filter((sp) => sp.productModel)
      .map((sp) => {
        const pModel = sp.productModel!;
        const pVariant = sp.productVariant;
        return {
          id: sp.id || pModel.id,
          productModelId: sp.productModelId || pModel.id,
          productVariantId: sp.productVariantId || pVariant?.id || null,
          model: {
            id: pModel.id,
            name: pModel.name,
            seriesName: pModel.productSeries?.name ?? null,
            category: pModel.productSeries?.productGroup ?? null,
          },
          variant: pVariant
            ? {
                id: pVariant.id,
                ram: sp.ram ?? pVariant.ram,
                rom: sp.rom ?? pVariant.rom,
                color: sp.color ?? pVariant.color,
              }
            : (sp.ram || sp.rom || sp.color)
              ? {
                  id: "custom",
                  ram: sp.ram ?? null,
                  rom: sp.rom ?? null,
                  color: sp.color ?? null,
                }
              : null,
          customProductName: sp.customProductName ?? null,
          ram: sp.ram ?? pVariant?.ram ?? null,
          rom: sp.rom ?? pVariant?.rom ?? null,
          color: sp.color ?? pVariant?.color ?? null,
          quantity: sp.quantity ?? 1,
          status: (sp.status as "INTERESTED" | "PURCHASED") || status || "INTERESTED",
        };
      });
  } else if (input.products) {
    const manualProducts = input.products.filter((p) => p.source === "MANUAL" && p.productModel);
    productsList = manualProducts.map((p) => ({
      id: p.productModel!.id,
      productModelId: p.productModel!.id,
      productVariantId: p.productVariant?.id ?? null,
      model: {
        id: p.productModel!.id,
        name: p.productModel!.name,
        seriesName: p.productModel!.productSeries?.name ?? null,
        category: p.productModel!.productSeries?.productGroup ?? null,
      },
      variant: p.productVariant
        ? {
            id: p.productVariant.id,
            ram: p.productVariant.ram,
            rom: p.productVariant.rom,
            color: p.productVariant.color,
          }
        : null,
      customProductName: null,
      ram: p.productVariant?.ram ?? null,
      rom: p.productVariant?.rom ?? null,
      color: p.productVariant?.color ?? null,
      quantity: 1,
      status: status || "PURCHASED",
    }));
  }

  return {
    status,
    interestLevel,
    purchaseChannel,
    paymentMethod,
    products: productsList,
    recordedBy,
    recordedAt: recordedAt && !Number.isNaN(recordedAt.getTime()) ? recordedAt.toISOString() : null,
  };
}

export function buildPurchaseInformation(input: {
  customerSalesStatus?: string | null;
  salesProducts?: readonly ConversationContractSalesProduct[] | null;
  sourceChannels?: readonly string[] | null;
  isInstallment?: boolean | null;
  paymentMethod?: string | null;
  products?: readonly ConversationContractProduct[] | null;
  purchaseRecordedBy?: { displayName?: string | null } | null;
  purchaseRecordedAt?: Date | string | null;
  salesRecordedBy?: { displayName?: string | null } | null;
  salesRecordedAt?: Date | string | null;
}): PurchaseInformationContract {
  const manualProducts = (input.products ?? [])
    .filter((product) => product.source === "MANUAL" && product.productModel);
  const rawRecordedAt = input.salesRecordedAt ?? input.purchaseRecordedAt;
  const recordedAt = rawRecordedAt
    ? rawRecordedAt instanceof Date
      ? rawRecordedAt
      : new Date(rawRecordedAt)
    : null;
  const hasValidRecordedAt = recordedAt !== null && !Number.isNaN(recordedAt.getTime());
  const hasLegacyManualData = manualProducts.length > 0 || (input.sourceChannels?.length ?? 0) > 0 || input.isInstallment === true || (input.salesProducts?.length ?? 0) > 0;
  const recordState = hasValidRecordedAt ? "VERIFIED" : hasLegacyManualData ? "LEGACY_MANUAL" : "NONE";

  const salesInfo = buildCustomerSalesInformation(input);
  const verifiedProducts = hasValidRecordedAt ? salesInfo.products : [];

  return {
    recordState,
    purchaseChannel: hasValidRecordedAt ? salesInfo.purchaseChannel : [],
    paymentMethod: hasValidRecordedAt && salesInfo.paymentMethod === "INSTALLMENT" ? "INSTALLMENT" : null,
    products: verifiedProducts.map((p) => ({
      model: p.model,
      variant: p.variant,
      source: "MANUAL" as const,
    })),
    recordedBy: hasValidRecordedAt ? salesInfo.recordedBy : null,
    recordedAt: hasValidRecordedAt ? salesInfo.recordedAt : null,
  };
}

export function buildAiInsight(input: {
  products?: readonly ConversationContractProduct[] | null;
  topics?: readonly ConversationContractTopic[] | null;
  productRelationship?: string | null;
  purchaseIntent?: string | null;
}): AiInsightContract {
  return {
    mentionedProducts: (input.products ?? [])
      .filter((product) => product.source === "RULE" && product.productModel)
      .map((product) => ({
        model: {
          id: product.productModel!.id,
          name: product.productModel!.name,
          seriesName: product.productModel!.productSeries?.name ?? null,
          category: product.productModel!.productSeries?.productGroup ?? null,
        },
        variant: product.productVariant
          ? {
              id: product.productVariant.id,
              ram: product.productVariant.ram,
              rom: product.productVariant.rom,
              color: product.productVariant.color,
            }
          : null,
        confidence: product.confidence ?? null,
        matchedPhrase: product.matchedPhrase ?? null,
        detectionMethod: product.detectionMethod ?? null,
        sourceMessageId: product.sourceMessageId ?? null,
      })),
    topics: (input.topics ?? [])
      .filter((topic) => topic.source === "RULE" && topic.topic)
      .map((topic) => ({
        id: topic.topic!.id,
        name: topic.topic!.name,
        category: topic.topic!.category,
        confidence: topic.confidence ?? null,
      })),
    classification: {
      productRelationship: input.productRelationship ?? null,
      purchaseIntent: input.purchaseIntent ?? null,
    },
  };
}

export function buildOperationalState(input: {
  replyStatus: string;
  priority?: string | null;
  unread?: number | null;
}): OperationalStateContract {
  return {
    replyStatus: input.replyStatus,
    priority: { level: input.priority ?? "NONE" },
    unread: input.unread ?? null,
  };
}