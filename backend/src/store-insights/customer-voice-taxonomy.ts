import { topicRules } from "../classification/topic-rules";

export const CUSTOMER_VOICE_ANALYSIS_VERSION = "customer-voice-rules-v1" as const;

export const CUSTOMER_VOICE_TOPIC_LABELS = [
  "Price Inquiry",
  "Promotion",
  "Stock Availability",
  "Product Information",
  "Installment / Payment",
  "Gift / Freebie",
  "Trade-in",
  "Store Location / Opening Hours",
  "Reservation / Order",
  "After-sales / Repair",
  "Complaint",
  "Greeting",
  "Other",
] as const;

export type CustomerVoiceTopic = typeof CUSTOMER_VOICE_TOPIC_LABELS[number];

export const CUSTOMER_VOICE_INTENTS = [
  "INFORMATION",
  "PRICE_CHECK",
  "PRODUCT_COMPARISON",
  "PURCHASE_CONSIDERATION",
  "READY_TO_BUY",
  "STOCK_CHECK",
  "PAYMENT_INQUIRY",
  "AFTER_SALES",
  "COMPLAINT",
  "GENERAL",
] as const;

export type CustomerVoiceIntentValue = typeof CUSTOMER_VOICE_INTENTS[number];

const TOPIC_ALIASES: Record<string, CustomerVoiceTopic> = {
  "price inquiry": "Price Inquiry",
  price: "Price Inquiry",
  promotion: "Promotion",
  "stock inquiry": "Stock Availability",
  "stock availability": "Stock Availability",
  "color availability": "Product Information",
  "product information": "Product Information",
  "model comparison": "Product Information",
  recommendation: "Product Information",
  installment: "Installment / Payment",
  "installment payment": "Installment / Payment",
  "gift freebie": "Gift / Freebie",
  "trade in": "Trade-in",
  "store location opening hours": "Store Location / Opening Hours",
  "reservation order": "Reservation / Order",
  "after sales repair": "After-sales / Repair",
  complaint: "Complaint",
  greeting: "Greeting",
  "test message": "Other",
  other: "Other",
};

const EXTRA_RULES: ReadonlyArray<{ topic: CustomerVoiceTopic; keywords: readonly string[] }> = [
  { topic: "Gift / Freebie", keywords: ["ของแถม", "ของฟรี", "ของสมนาคุณ", "gift", "freebie"] },
  { topic: "Store Location / Opening Hours", keywords: ["สาขา", "อยู่ที่ไหน", "เปิดกี่โมง", "location", "opening hours", "where are you"] },
  { topic: "Reservation / Order", keywords: ["จอง", "สั่งซื้อ", "reserve", "order", "pre-order", "preorder"] },
  { topic: "Product Information", keywords: ["สเปค", "รายละเอียด", "ฟีเจอร์", "spec", "feature", "ข้อมูลรุ่น", "มีอะไรบ้าง"] },
];

const TOPIC_PRIORITY: Record<CustomerVoiceTopic, number> = {
  Complaint: 100,
  "After-sales / Repair": 90,
  "Stock Availability": 80,
  "Price Inquiry": 70,
  Promotion: 65,
  "Installment / Payment": 60,
  "Reservation / Order": 55,
  "Product Information": 50,
  "Trade-in": 45,
  "Gift / Freebie": 40,
  "Store Location / Opening Hours": 30,
  Greeting: 10,
  Other: 0,
};

function topicKey(value: string): string {
  return value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function canonicalizeCustomerVoiceTopic(value: string | null | undefined): CustomerVoiceTopic | null {
  const key = value ? topicKey(value) : "";
  if (!key) return null;
  return TOPIC_ALIASES[key] ?? "Other";
}

export function inferCustomerVoiceTopics(text: string): CustomerVoiceTopic[] {
  const normalized = text.toLocaleLowerCase();
  const inferred = topicRules
    .filter(({ keywords }) => keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase())))
    .map(({ name }) => canonicalizeCustomerVoiceTopic(name))
    .concat(EXTRA_RULES.filter(({ keywords }) => keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase()))).map(({ topic }) => topic));
  return [...new Set(inferred.filter((topic): topic is CustomerVoiceTopic => topic !== null))]
    .sort((left, right) => TOPIC_PRIORITY[right] - TOPIC_PRIORITY[left] || left.localeCompare(right));
}

export function choosePrimaryCustomerVoiceTopic(topics: readonly CustomerVoiceTopic[]): CustomerVoiceTopic | null {
  return [...new Set(topics)].sort((left, right) => TOPIC_PRIORITY[right] - TOPIC_PRIORITY[left] || left.localeCompare(right))[0] ?? null;
}

export function deriveCustomerVoiceIntent(text: string, topics: readonly CustomerVoiceTopic[], hasProduct: boolean): CustomerVoiceIntentValue | null {
  const normalized = text.toLocaleLowerCase();
  const topicSet = new Set(topics);
  if (topicSet.has("Complaint")) return "COMPLAINT";
  if (topicSet.has("After-sales / Repair")) return "AFTER_SALES";
  if (/(พร้อมซื้อ|ซื้อเลย|เอารุ่น|สั่งซื้อ|จอง|รับเครื่อง|buy now|ready to buy|order now)/u.test(normalized)) return "READY_TO_BUY";
  if (topicSet.has("Stock Availability")) return "STOCK_CHECK";
  if (topicSet.has("Installment / Payment")) return "PAYMENT_INQUIRY";
  if (topicSet.has("Product Information") && /(เทียบ|ต่างกัน|compare|difference|对比|区别)/u.test(normalized)) return "PRODUCT_COMPARISON";
  if (topicSet.has("Price Inquiry")) return "PRICE_CHECK";
  if (topicSet.has("Product Information") || hasProduct) return "INFORMATION";
  if (topicSet.has("Promotion") || topicSet.has("Trade-in") || topicSet.has("Reservation / Order") || topicSet.has("Gift / Freebie")) return "PURCHASE_CONSIDERATION";
  if (topicSet.has("Greeting") || topicSet.has("Other")) return "GENERAL";
  return null;
}

export function customerVoiceTopicSort(left: string, right: string): number {
  return (TOPIC_PRIORITY[right as CustomerVoiceTopic] ?? 0) - (TOPIC_PRIORITY[left as CustomerVoiceTopic] ?? 0) || left.localeCompare(right);
}
