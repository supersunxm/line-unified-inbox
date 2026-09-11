import { topicRules } from "../classification/topic-rules";

/** Current deterministic ruleset. Historical v1/v2 rows remain identifiable and immutable. */
export const CUSTOMER_VOICE_ANALYSIS_VERSION = "customer-voice-rules-v3" as const;

export const CUSTOMER_VOICE_TOPIC_LABELS = [
  "Price Inquiry",
  "Promotion",
  "Stock Availability",
  "Product Information",
  "Installment / Payment",
  "Gift / Freebie",
  "Trade-in",
  "Store Location / Opening Hours",
  "Store Contact",
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
  "price check": "Price Inquiry",
  promotion: "Promotion",
  "stock inquiry": "Stock Availability",
  "stock availability": "Stock Availability",
  stock: "Stock Availability",
  availability: "Stock Availability",
  "product availability": "Stock Availability",
  "color availability": "Product Information",
  "product information": "Product Information",
  "product question": "Product Information",
  "model comparison": "Product Information",
  recommendation: "Product Information",
  installment: "Installment / Payment",
  "installment payment": "Installment / Payment",
  "gift freebie": "Gift / Freebie",
  "trade in": "Trade-in",
  "store location opening hours": "Store Location / Opening Hours",
  "store information": "Store Location / Opening Hours",
  "store contact": "Store Contact",
  "reservation order": "Reservation / Order",
  "after sales repair": "After-sales / Repair",
  complaint: "Complaint",
  "after sales": "After-sales / Repair",
  "service request": "After-sales / Repair",
  greeting: "Greeting",
  "test message": "Other",
  other: "Other",
};

const EXTRA_RULES: ReadonlyArray<{ topic: CustomerVoiceTopic; keywords: readonly string[]; patterns?: readonly RegExp[] }> = [
  { topic: "Gift / Freebie", keywords: ["ของแถม", "ของฟรี", "ของสมนาคุณ", "gift", "freebie"] },
  { topic: "Stock Availability", keywords: ["ยังมี", "เหลือไหม", "เหลือมั้ย", "พร้อมส่ง", "มีสินค้า", "มีเครื่อง", "ของยังมี", "ว่างไหม"], patterns: [/(?:รุ่น|เครื่อง|มือถือ|โทรศัพท์|สินค้า|ของ|oppo|reno|find|a\d)\s*(?:มี|เหลือ|พร้อมส่ง|ว่าง|หมด)/iu] },
  { topic: "Store Location / Opening Hours", keywords: ["สาขา", "อยู่ที่ไหน", "ร้านอยู่", "อยู่ตรงไหน", "พิกัด", "แผนที่", "เปิดกี่โมง", "ปิดกี่โมง", "เวลาทำการ", "location", "opening hours", "where are you"] },
  { topic: "Store Contact", keywords: ["เบอร์ติดต่อ", "เบอร์โทร", "โทรหาร้าน", "ไลน์ร้าน", "แอดไลน์", "ติดต่อทางไลน์", "ติดต่อร้าน", "contact store", "store phone"], patterns: [/(?:ขอ|มี|ส่ง)?\s*(?:เบอร์|หมายเลข)(?:โทร|ติดต่อ)?|(?:โทร|ติดต่อ)(?:กลับ|หา|ร้าน|สาขา|ทางไหน|อย่างไร|ยังไง)|(?:ทัก|แอด)(?:ไลน์|ร้าน)/u] },
  { topic: "Reservation / Order", keywords: ["จอง", "ขอจอง", "สั่งซื้อ", "รับเครื่อง", "พร้อมรับ", "reserve", "order", "pre-order", "preorder"], patterns: [/(?:ขอ|อยาก|จะ)?\s*(?:จอง|สั่งซื้อ|รับเครื่อง)/u] },
  { topic: "Trade-in", keywords: ["เทิร์นเครื่อง", "เทิร์น", "ตีราคาเครื่องเก่า", "แลกเครื่อง", "เครื่องเก่า", "trade-in", "trade in"] },
  { topic: "After-sales / Repair", keywords: ["ใช้งานไม่ได้", "ใช้ไม่ได้", "มีปัญหา", "แก้ไข", "สอบถามการใช้งาน"], patterns: [/(?:ใช้|ใช้งาน)\s*ไม่ได้|(?:ช่วย|ขอ)\s*(?:แก้|ตรวจ|เช็ค)/u] },
  { topic: "Product Information", keywords: ["สเปค", "รายละเอียด", "รายละเอียดเพิ่มเติม", "ขอรายละเอียด", "ฟีเจอร์", "spec", "feature", "ข้อมูลรุ่น", "สนใจรุ่น", "สนใจมือถือ", "อยากได้ข้อมูล", "รุ่นไหน", "รุ่นอะไร", "มือถือรุ่น", "โทรศัพท์รุ่น"], patterns: [/(?:มือถือ|โทรศัพท์|เครื่อง|รุ่น)\s*(?:รุ่น)?\s*(?:ไหน|อะไร|ใด|นี้)|(?:มี|ขาย|แนะนำ)\s*(?:มือถือ|โทรศัพท์|เครื่อง|รุ่น)|(?:ขอ|อยาก|รบกวน|สอบถาม|สนใจ).{0,16}(?:ข้อมูล|รายละเอียด|สเปค).{0,16}(?:รุ่น|มือถือ|โทรศัพท์|เครื่อง|oppo|reno|find)/u] },
  { topic: "Installment / Payment", keywords: ["ดาวน์", "เงินดาวน์", "ค่างวด", "งวดละ", "เดือนละ", "กี่งวด", "สินเชื่อ", "ชำระ", "จ่าย", "down payment", "payment plan"], patterns: [/บัตร(?:อะไร|ไหน)|(?:ใช้|รับ|จ่าย|รูด)(?:ผ่าน|ด้วย)?\s*บัตร|เครดิต(?!บูโร)|(?:ผ่อน|ดาวน์|ค่างวด).{0,16}(?:เดือน|งวด|บาท|เท่าไหร่)/u] },
  { topic: "Price Inquiry", keywords: ["ราคาเริ่มต้น", "ราคาประมาณ", "งบประมาณ", "งบ", "price", "how much"] },
];

const TOPIC_PRIORITY: Record<CustomerVoiceTopic, number> = {
  Complaint: 100,
  "After-sales / Repair": 90,
  "Stock Availability": 80,
  "Price Inquiry": 70,
  Promotion: 65,
  "Installment / Payment": 75,
  "Reservation / Order": 55,
  "Product Information": 50,
  "Trade-in": 45,
  "Gift / Freebie": 40,
  "Store Location / Opening Hours": 30,
  "Store Contact": 35,
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
    .concat(EXTRA_RULES.filter(({ keywords, patterns }) => keywords.some((keyword) => normalized.includes(keyword.toLocaleLowerCase())) || patterns?.some((pattern) => pattern.test(normalized))).map(({ topic }) => topic));
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
  if (/(พร้อมซื้อ|ซื้อเลย|ขอซื้อ|เอารุ่น|เอาเครื่องนี้|สั่งซื้อ|จอง|รับเครื่อง|buy now|ready to buy|order now)/u.test(normalized)) return "READY_TO_BUY";
  if (topicSet.has("Stock Availability")) return "STOCK_CHECK";
  if (topicSet.has("Product Information") && /(เทียบ|ต่างกัน|compare|difference|对比|区别)/u.test(normalized)) return "PRODUCT_COMPARISON";
  if (topicSet.has("Price Inquiry")) return "PRICE_CHECK";
  if (topicSet.has("Installment / Payment")) return "PAYMENT_INQUIRY";
  if (topicSet.has("Product Information") && /(สนใจ|อยากได้|กำลังดู|ขอคำแนะนำ)/u.test(normalized)) return "PURCHASE_CONSIDERATION";
  if (topicSet.has("Product Information") || hasProduct) return "INFORMATION";
  if (topicSet.has("Store Location / Opening Hours") || topicSet.has("Store Contact")) return "INFORMATION";
  if (topicSet.has("Promotion") || topicSet.has("Trade-in") || topicSet.has("Reservation / Order") || topicSet.has("Gift / Freebie")) return "PURCHASE_CONSIDERATION";
  if (topicSet.has("Greeting") || topicSet.has("Other")) return "GENERAL";
  return null;
}

export function customerVoiceTopicSort(left: string, right: string): number {
  return (TOPIC_PRIORITY[right as CustomerVoiceTopic] ?? 0) - (TOPIC_PRIORITY[left as CustomerVoiceTopic] ?? 0) || left.localeCompare(right);
}
