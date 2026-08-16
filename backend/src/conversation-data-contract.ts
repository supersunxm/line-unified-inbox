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

export function buildPurchaseInformation(input: {
  sourceChannels?: readonly string[] | null;
  isInstallment?: boolean | null;
  products?: readonly ConversationContractProduct[] | null;
  purchaseRecordedBy?: { displayName?: string | null } | null;
  purchaseRecordedAt?: Date | string | null;
}): PurchaseInformationContract {
  const manualProducts = (input.products ?? [])
    .filter((product) => product.source === "MANUAL" && product.productModel);
  const recordedAt = input.purchaseRecordedAt
    ? input.purchaseRecordedAt instanceof Date
      ? input.purchaseRecordedAt
      : new Date(input.purchaseRecordedAt)
    : null;
  const hasValidRecordedAt = recordedAt !== null && !Number.isNaN(recordedAt.getTime());
  const hasLegacyManualData = manualProducts.length > 0 || (input.sourceChannels?.length ?? 0) > 0 || input.isInstallment === true;
  const recordState = hasValidRecordedAt ? "VERIFIED" : hasLegacyManualData ? "LEGACY_MANUAL" : "NONE";
  const verifiedProducts = hasValidRecordedAt ? manualProducts : [];
  return {
    recordState,
    purchaseChannel: hasValidRecordedAt ? [...(input.sourceChannels ?? [])] : [],
    paymentMethod: hasValidRecordedAt && input.isInstallment ? "INSTALLMENT" : null,
    products: verifiedProducts.map((product) => ({
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
        source: "MANUAL" as const,
      })),
    recordedBy: input.purchaseRecordedBy?.displayName?.trim() || null,
    recordedAt: hasValidRecordedAt ? recordedAt.toISOString() : null,
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
