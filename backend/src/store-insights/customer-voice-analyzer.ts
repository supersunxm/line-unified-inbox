import { CustomerVoiceAnalysisSource } from "@prisma/client";
import type { ProductMatch } from "../classification/product-matcher";
import {
  canonicalizeCustomerVoiceTopic,
  choosePrimaryCustomerVoiceTopic,
  CustomerVoiceIntentValue,
  CustomerVoiceTopic,
  deriveCustomerVoiceIntent,
  inferCustomerVoiceTopics,
} from "./customer-voice-taxonomy";

export type CustomerVoiceInboundMessage = {
  id: string;
  originalText: string;
  sentAt: Date;
};

export type CustomerVoiceExistingTopic = {
  name: string;
  confidence?: number | null;
};

export type CustomerVoiceAnalysisDraft = {
  source: CustomerVoiceAnalysisSource;
  primaryTopic: CustomerVoiceTopic | null;
  secondaryTopics: CustomerVoiceTopic[];
  intent: CustomerVoiceIntentValue | null;
  productMentions: string[];
  rawProductMentions: string[];
  confidence: number | null;
  summary: string | null;
  inputMessageCount: number;
  lastAnalyzedMessageAt: Date | null;
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 100) / 100;
}

function uniqueTopics(topics: Array<CustomerVoiceTopic | null>): CustomerVoiceTopic[] {
  return [...new Set(topics.filter((topic): topic is CustomerVoiceTopic => topic !== null))];
}

function summaryText(primaryTopic: CustomerVoiceTopic | null, intent: CustomerVoiceIntentValue | null, products: string[]): string | null {
  const signals = [
    primaryTopic ? `topic ${primaryTopic}` : null,
    intent ? `intent ${intent}` : null,
    products.length > 0 ? `products ${products.join(", ")}` : null,
  ].filter((value): value is string => Boolean(value));
  return signals.length > 0 ? `Customer voice signals: ${signals.join("; ")}.` : null;
}

export function normalizeCustomerVoiceProductMatches(productMatches: readonly ProductMatch[]): ProductMatch[] {
  const exactSeries = new Set(productMatches
    .filter(({ model }) => model.classificationLevel === "MODEL")
    .map(({ model }) => model.productSeries?.name)
    .filter((name): name is string => Boolean(name)));
  return productMatches.filter(({ model }) => model.classificationLevel !== "FAMILY" || !model.productSeries?.name || !exactSeries.has(model.productSeries.name));
}

export function buildCustomerVoiceAnalysis(
  messages: readonly CustomerVoiceInboundMessage[],
  existingTopics: readonly CustomerVoiceExistingTopic[],
  productMatches: readonly ProductMatch[],
): CustomerVoiceAnalysisDraft {
  const text = messages.map(({ originalText }) => originalText.trim()).filter(Boolean).join(" ");
  const existing = uniqueTopics(existingTopics.map(({ name }) => canonicalizeCustomerVoiceTopic(name)));
  const inferred = inferCustomerVoiceTopics(text);
  const normalizedProductMatches = normalizeCustomerVoiceProductMatches(productMatches);
  const productMentions = [...new Set(normalizedProductMatches.map(({ model }) => model.name).filter(Boolean))];
  const inferredWithProduct = productMentions.length > 0 && !inferred.includes("Product Information")
    ? [...inferred, "Product Information" as const]
    : inferred;
  const allTopics = uniqueTopics([...existing, ...inferredWithProduct]);
  const primaryTopic = choosePrimaryCustomerVoiceTopic(allTopics);
  const secondaryTopics = allTopics.filter((topic) => topic !== primaryTopic);
  const intent = deriveCustomerVoiceIntent(text, allTopics, productMentions.length > 0);
  const hasSignal = allTopics.length > 0 || intent !== null || productMentions.length > 0;
  const hasEnrichment = inferredWithProduct.some((topic) => !existing.includes(topic)) || productMentions.length > 0;
  const source = !hasSignal
    ? CustomerVoiceAnalysisSource.UNCLASSIFIED
    : existing.length === 0
      ? CustomerVoiceAnalysisSource.RULE_ENRICHED
      : hasEnrichment
        ? CustomerVoiceAnalysisSource.MIXED_ENRICHED
        : CustomerVoiceAnalysisSource.EXISTING_TOPIC;
  const confidence = hasSignal
    ? average([
      ...existingTopics.flatMap(({ confidence: value }) => typeof value === "number" && Number.isFinite(value) ? [Math.max(0, Math.min(1, value))] : []),
      ...inferredWithProduct.map(() => 0.85),
      ...normalizedProductMatches.map(({ confidence: value }) => Math.max(0, Math.min(1, value))),
      ...(existing.length > 0 && inferredWithProduct.length === 0 && productMatches.length === 0 ? [0.75] : []),
    ])
    : null;
  const lastAnalyzedMessageAt = messages.reduce<Date | null>((latest, message) => !latest || message.sentAt > latest ? message.sentAt : latest, null);

  return {
    source,
    primaryTopic,
    secondaryTopics,
    intent,
    productMentions,
    rawProductMentions: [...new Set(normalizedProductMatches.map(({ matchedPhrase }) => matchedPhrase).filter(Boolean))],
    confidence,
    summary: summaryText(primaryTopic, intent, productMentions),
    inputMessageCount: messages.length,
    lastAnalyzedMessageAt,
  };
}

export function isUsableCustomerVoiceAnalysis(analysis: Pick<CustomerVoiceAnalysisDraft, "primaryTopic" | "intent" | "productMentions">): boolean {
  return Boolean(analysis.primaryTopic || analysis.intent || analysis.productMentions.length > 0);
}
