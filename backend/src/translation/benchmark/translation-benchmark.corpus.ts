import { TranslationBenchmarkCase } from "./translation-benchmark.types";

export const TRANSLATION_BENCHMARK_VERSION = "oppo-th-en-zh-v2";

// Synthetic operational examples only. Do not replace these with production customer messages.
export const TRANSLATION_BENCHMARK_CORPUS: TranslationBenchmarkCase[] = [
  {
    id: "stock-color-find-x9-pro",
    sourceLanguage: "th",
    sourceText: "มี OPPO Find X9 Pro สีดำไหมครับ",
    references: { en: "Is OPPO Find X9 Pro available in black?", zh: "OPPO Find X9 Pro 有黑色版本吗？" },
    protectedTerms: ["OPPO Find X9 Pro"],
    tags: ["stock", "color", "product-name"],
  },
  {
    id: "price-reno16",
    sourceLanguage: "th",
    sourceText: "OPPO Reno16 ราคาเท่าไหร่คะ",
    references: { en: "How much does OPPO Reno16 cost?", zh: "OPPO Reno16 多少钱？" },
    protectedTerms: ["OPPO Reno16"],
    tags: ["price", "product-name"],
  },
  {
    id: "installment-a6-pro-5g",
    sourceLanguage: "th",
    sourceText: "OPPO A6 Pro 5G ผ่อนได้กี่เดือน",
    references: { en: "How many months can I pay for OPPO A6 Pro 5G in installments?", zh: "OPPO A6 Pro 5G 可以分期几个月？" },
    protectedTerms: ["OPPO A6 Pro 5G"],
    tags: ["installment", "product-name"],
  },
  {
    id: "storage-pad3",
    sourceLanguage: "th",
    sourceText: "OPPO Pad 3 มีรุ่น 256GB หรือเปล่า",
    references: { en: "Is OPPO Pad 3 available in a 256GB version?", zh: "OPPO Pad 3 有 256GB 版本吗？" },
    protectedTerms: ["OPPO Pad 3", "256GB"],
    tags: ["storage", "product-name"],
  },
  {
    id: "accessory-supervooc",
    sourceLanguage: "th",
    sourceText: "หัวชาร์จ SUPERVOOC ใช้กับ Find X9 ได้ไหม",
    references: { en: "Can the SUPERVOOC charger be used with Find X9?", zh: "SUPERVOOC 充电器可以用于 Find X9 吗？" },
    protectedTerms: ["SUPERVOOC", "Find X9"],
    tags: ["compatibility", "accessory", "product-name"],
  },
  {
    id: "after-sales-screen",
    sourceLanguage: "th",
    sourceText: "หน้าจอแตก ส่งซ่อมที่สาขาได้ไหมครับ",
    references: { en: "My screen is cracked. Can I send it for repair at the store?", zh: "我的屏幕碎了，可以送到门店维修吗？" },
    protectedTerms: [],
    tags: ["after-sales", "repair"],
  },
  {
    id: "warranty",
    sourceLanguage: "th",
    sourceText: "ถ้าเครื่องมีปัญหาภายในเจ็ดวันเปลี่ยนเครื่องได้ไหม",
    references: { en: "If the device has a problem within seven days, can it be replaced?", zh: "如果设备在七天内出现问题，可以换机吗？" },
    protectedTerms: [],
    tags: ["after-sales", "warranty"],
  },
  {
    id: "promotion-enco-air4",
    sourceLanguage: "th",
    sourceText: "Enco Air4 ตอนนี้มีโปรอะไรบ้าง",
    references: { en: "What promotions are currently available for Enco Air4?", zh: "Enco Air4 目前有什么促销活动？" },
    protectedTerms: ["Enco Air4"],
    tags: ["promotion", "product-name"],
  },
  {
    id: "store-pickup",
    sourceLanguage: "th",
    sourceText: "สั่งออนไลน์แล้วไปรับที่ร้านได้ไหมคะ",
    references: { en: "Can I order online and pick it up at the store?", zh: "可以在线下单后到门店取货吗？" },
    protectedTerms: [],
    tags: ["order", "store-pickup"],
  },
  {
    id: "mixed-language-trade-in",
    sourceLanguage: "th",
    sourceText: "เอา iPhone มา trade-in ซื้อ OPPO ได้ไหม",
    references: { en: "Can I trade in an iPhone when buying an OPPO phone?", zh: "购买 OPPO 手机时可以用 iPhone 以旧换新吗？" },
    protectedTerms: ["iPhone", "OPPO"],
    tags: ["trade-in", "mixed-language", "brand-name"],
  },
  {
    id: "down-payment-only",
    sourceLanguage: "th",
    sourceText: "ดาวน์เท่าไหร่ครับ",
    references: { en: "How much is the down payment?", zh: "首付是多少？" },
    protectedTerms: [],
    tags: ["down-payment", "intent"],
  },
  {
    id: "availability-only",
    sourceLanguage: "th",
    sourceText: "มีของไหมครับ",
    references: { en: "Is it in stock?", zh: "有现货吗？" },
    protectedTerms: [],
    tags: ["stock", "intent"],
  },
  {
    id: "oppo-technology-suite",
    sourceLanguage: "th",
    sourceText: "ColorOS มี AI Eraser กับ AI Studio และรองรับ AirVOOC ไหม",
    references: { en: "Does ColorOS include AI Eraser and AI Studio, and does it support AirVOOC?", zh: "ColorOS 是否包含 AI Eraser 和 AI Studio，并支持 AirVOOC？" },
    protectedTerms: ["ColorOS", "AI Eraser", "AI Studio", "AirVOOC"],
    tags: ["technology", "software", "charging"],
  },
  {
    id: "find-x9-ultra-display",
    sourceLanguage: "th",
    sourceText: "Find X9 Ultra ใช้จอ AMOLED และหน่วยความจำ UFS ไหม",
    references: { en: "Does Find X9 Ultra use an AMOLED display and UFS storage?", zh: "Find X9 Ultra 是否采用 AMOLED 屏幕和 UFS 存储？" },
    protectedTerms: ["Find X9 Ultra", "AMOLED", "UFS"],
    tags: ["product-name", "display", "storage"],
  },
  {
    id: "reno16-pro-watch",
    sourceLanguage: "th",
    sourceText: "Reno16 Pro เชื่อมกับ OPPO Watch ได้ไหม แล้ว OPPO Pad ใช้ด้วยกันได้หรือเปล่า",
    references: { en: "Can Reno16 Pro connect to OPPO Watch, and can it also be used with OPPO Pad?", zh: "Reno16 Pro 可以连接 OPPO Watch 吗？它也可以与 OPPO Pad 一起使用吗？" },
    protectedTerms: ["Reno16 Pro", "OPPO Watch", "OPPO Pad"],
    tags: ["compatibility", "mixed-products"],
  },
];

for (const testCase of TRANSLATION_BENCHMARK_CORPUS) {
  Object.freeze(testCase.references);
  Object.freeze(testCase.protectedTerms);
  Object.freeze(testCase.tags);
  Object.freeze(testCase);
}
Object.freeze(TRANSLATION_BENCHMARK_CORPUS);
