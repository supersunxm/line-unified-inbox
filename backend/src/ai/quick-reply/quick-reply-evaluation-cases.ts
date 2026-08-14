import type { QuickReplyContext, QuickReplyLocale } from "./quick-reply.types";

export interface QuickReplyEvaluationCase {
  id: string;
  locale: QuickReplyLocale;
  message: string;
  productModels: string[];
  topics: string[];
  expectedIntent: string;
  expectedSource: "RULE" | "CATALOG" | "FALLBACK";
}

export const QUICK_REPLY_EVALUATION_CASES: QuickReplyEvaluationCase[] = [
  { id: "greeting-th", locale: "th", message: "สวัสดีค่ะ", productModels: [], topics: [], expectedIntent: "GREETING", expectedSource: "RULE" },
  { id: "product-en", locale: "en", message: "Tell me about this phone", productModels: ["OPPO Reno16"], topics: ["PRODUCT_FEATURE"], expectedIntent: "PRODUCT_INFORMATION", expectedSource: "CATALOG" },
  { id: "after-sales-zh", locale: "zh", message: "手机需要维修", productModels: [], topics: ["AFTER_SALES"], expectedIntent: "HUMAN_HANDOFF", expectedSource: "FALLBACK" },
  { id: "unknown-th", locale: "th", message: "ช่วยดูเรื่องนี้ให้หน่อยค่ะ", productModels: [], topics: [], expectedIntent: "HUMAN_HANDOFF", expectedSource: "FALLBACK" },
];

export function evaluationContext(item: QuickReplyEvaluationCase): QuickReplyContext {
  return {
    conversationId: `evaluation-${item.id}`,
    storeId: "evaluation-store",
    contextMessageId: `evaluation-message-${item.id}`,
    contextVersion: "evaluation-version",
    locale: item.locale,
    storeName: "Evaluation Store",
    recentMessages: [{ id: `evaluation-message-${item.id}`, role: "CUSTOMER", direction: "INBOUND", messageType: "TEXT", text: item.message, sentAt: "2026-08-14T00:00:00.000Z" }],
    signals: { topics: item.topics, productModels: item.productModels },
    approvedFacts: [],
    builtAt: "2026-08-14T00:00:00.000Z",
    expiresAt: "2026-08-14T00:02:00.000Z",
  };
}
