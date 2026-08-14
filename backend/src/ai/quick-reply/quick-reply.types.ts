import type { AuthUser } from "../../auth/auth.guard";

export type QuickReplyLocale = "th" | "en" | "zh";
export type QuickReplySuggestionSource = "RULE" | "CATALOG" | "STORE_POLICY" | "FALLBACK";
export type QuickReplyRiskFlag = "UNVERIFIED_FACT" | "PRICE_OR_STOCK" | "WARRANTY_OR_LEGAL" | "PAYMENT_OR_REFUND" | "PII" | "HANDOFF_REQUIRED";

export interface QuickReplyFact {
  key: string;
  value: string;
  source: "PRODUCT_CATALOG" | "STORE_MASTER" | "APPROVED_POLICY";
  verifiedAt: string;
  expiresAt?: string;
}

export interface QuickReplyContextMessage {
  id: string;
  role: "CUSTOMER" | "BM";
  direction: "INBOUND" | "OUTBOUND";
  messageType: string;
  text?: string;
  sentAt: string;
}

export interface QuickReplyContext {
  conversationId: string;
  storeId: string;
  contextMessageId: string;
  contextVersion: string;
  locale: QuickReplyLocale;
  customerDisplayName?: string;
  storeName: string;
  storeCode?: string;
  recentMessages: QuickReplyContextMessage[];
  signals: {
    topics: string[];
    productModels: string[];
    purchaseIntent?: string;
    productRelationship?: string;
  };
  approvedFacts: QuickReplyFact[];
  builtAt: string;
  expiresAt: string;
}

export interface QuickReplyProviderInput {
  context: QuickReplyContext;
  maxSuggestions: number;
}

export interface QuickReplyProviderCandidate {
  text: string;
  intent: string;
  source: QuickReplySuggestionSource;
  confidence: number;
  grounded: boolean;
  riskFlags: QuickReplyRiskFlag[];
}

export interface QuickReplyProviderResult {
  providerName: string;
  providerVersion: string;
  candidates: QuickReplyProviderCandidate[];
  latencyMs: number;
}

export interface QuickReplyProvider {
  generate(input: QuickReplyProviderInput): Promise<QuickReplyProviderResult>;
}

export interface QuickReplySafetyResult {
  accepted: QuickReplyProviderCandidate[];
  rejected: Array<{
    index: number;
    reason: "UNSUPPORTED_INTENT" | "UNGROUNDED_FACT" | "HIGH_RISK_CONTENT" | "INVALID_OUTPUT" | "PROMPT_INJECTION" | "EMPTY_TEXT";
    riskFlags: QuickReplyRiskFlag[];
  }>;
  fallbackRequired: boolean;
}

export type QuickReplyLifecycleEventType = "SHOWN" | "SELECTED" | "EDITED" | "DISMISSED";
export type QuickReplyAuditEventType = "REQUESTED" | "GENERATED" | "SHOWN" | "SELECTED" | "EDITED" | "DISMISSED" | "FAILED";

export interface QuickReplyAuditEvent {
  eventType: QuickReplyAuditEventType;
  actorUserId: string;
  conversationId: string;
  contextMessageId?: string;
  generationId?: string;
  providerName?: string;
  providerVersion?: string;
  sourceTypes?: string[];
  riskFlags?: string[];
  latencyMs?: number;
  outcome?: string;
}

export interface QuickReplyGenerationRecord {
  generationId: string;
  userId: string;
  conversationId: string;
  contextMessageId: string;
  contextVersion: string;
  locale: QuickReplyLocale;
  suggestionIds: string[];
  expiresAt: number;
}

export type QuickReplyActor = Pick<AuthUser, "id" | "role">;
