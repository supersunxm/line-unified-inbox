import { Priority, ProductRelationship, PurchaseIntent } from "@prisma/client";
import { criticalKeywords, topicRules } from "./topic-rules";

const purchaseKeywords = [
  "ซื้อ", "รับเครื่อง", "จอง", "สั่งซื้อ", "เอารุ่น", "พร้อมซื้อ",
  "buy", "purchase", "order", "reserve", "pick it up", "ready to buy",
  "购买", "买", "下单", "预订", "订购", "想买",
];

export type ClassificationSuggestion = {
  matchedRules: typeof topicRules[number][];
  productRelationship: ProductRelationship | undefined;
  purchaseIntent: PurchaseIntent;
  priority: Priority;
};

export function classifyConversationText(rawText: string, hasMatchedProduct: boolean): ClassificationSuggestion {
  const text = rawText.toLocaleLowerCase();
  const matchedRules = topicRules.filter(({ keywords }) => keywords.some((keyword) => text.includes(keyword)));
  const hasAfterSales = matchedRules.some(({ category }) => category === "AFTER_SALES");
  const complaint = matchedRules.some(({ category }) => category === "COMPLAINT");
  const critical = criticalKeywords.some((keyword) => text.includes(keyword));
  const explicitPurchase = purchaseKeywords.some((keyword) => text.includes(keyword));
  const stock = matchedRules.some(({ name }) => name === "Stock Inquiry");
  const commercial = matchedRules.some(({ name }) => name === "Price Inquiry" || name === "Installment" || name === "Promotion");
  const highIntent = explicitPurchase || (stock && commercial);
  const lowValue = matchedRules.length > 0 && matchedRules.every(({ name }) => name === "Greeting" || name === "Test Message");

  return {
    matchedRules,
    productRelationship: hasAfterSales ? ProductRelationship.CURRENT_OWNER : hasMatchedProduct ? ProductRelationship.INTERESTED : undefined,
    purchaseIntent: hasAfterSales ? PurchaseIntent.AFTER_SALES : highIntent ? PurchaseIntent.HIGH : commercial || stock || hasMatchedProduct ? PurchaseIntent.MEDIUM : PurchaseIntent.UNKNOWN,
    priority: critical ? Priority.CRITICAL : complaint || hasAfterSales || highIntent ? Priority.HIGH : lowValue ? Priority.LOW : Priority.NORMAL,
  };
}
