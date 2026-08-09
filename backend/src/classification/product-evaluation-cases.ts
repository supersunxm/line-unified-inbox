/**
 * Product Classification Evaluation Dataset
 *
 * 100 realistic customer messages from OPPO Thailand LINE OA chats.
 * Used by product-evaluation.spec.ts to produce an accuracy report.
 *
 * expectedModel: exact productModel.name in PRODUCT_CATALOG, or null = "expect NO MATCH"
 * expectedDetectionMethod: optional — when specified, assertion is strict
 */

export type EvaluationCase = {
  message: string;
  expectedModel: string | null;
  expectedDetectionMethod?: string;
  notes?: string;
};

export const EVALUATION_CASES: EvaluationCase[] = [
  // ── RENO16 BASE (10 cases) ────────────────────────────────────────────────
  { message: "reno16 ราคาเท่าไหร่", expectedModel: "OPPO Reno16", notes: "base model + price query" },
  { message: "Reno16 มีสีอะไรบ้างคะ", expectedModel: "OPPO Reno16", notes: "color inquiry" },
  { message: "มีรุ่น Reno 16 ไหมคะ", expectedModel: "OPPO Reno16", notes: "spaced variant" },
  { message: "สนใจ รีโน 16 ค่ะ", expectedModel: "OPPO Reno16", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai phonetic base" },
  { message: "รีโน16 ราคาล่าสุด", expectedModel: "OPPO Reno16", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai compact alias" },
  { message: "เรโน 16 ผ่อนได้ไหม", expectedModel: "OPPO Reno16", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai phonetic alt spelling" },
  { message: "มีโปรผ่อน reno16 ไหม", expectedModel: "OPPO Reno16", notes: "promotion + base model only (not Pro)" },
  { message: "Reno16/F 8+128 ราคาเท่าไร", expectedModel: "OPPO Reno16", notes: "storage config suffix" },
  { message: "reno16 กล้องดีไหมคะ", expectedModel: "OPPO Reno16", notes: "camera question" },
  { message: "สนใจ Reno 16 สีดำ", expectedModel: "OPPO Reno16", notes: "color suffix" },

  // ── RENO16 PRO (10 cases) ─────────────────────────────────────────────────
  { message: "reno16 pro ราคาเท่าไหร่", expectedModel: "OPPO Reno16 Pro 5G", expectedDetectionMethod: "EXACT_ALIAS", notes: "pro + price" },
  { message: "Reno16 Pro มีสีอะไรบ้าง", expectedModel: "OPPO Reno16 Pro 5G", notes: "pro color" },
  { message: "สนใจ Reno16 Pro ครับ", expectedModel: "OPPO Reno16 Pro 5G", notes: "pro interest" },
  { message: "รีโน16โปร ราคา", expectedModel: "OPPO Reno16 Pro 5G", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai compact pro" },
  { message: "รีโน 16 โปร สีขาว", expectedModel: "OPPO Reno16 Pro 5G", expectedDetectionMethod: "COMPACT_ALIAS", notes: "Thai spaced pro — catalog uses SAFE_COMPACT so spaced form uses COMPACT_ALIAS" },
  { message: "เรโน16โปร มีไหมคะ", expectedModel: "OPPO Reno16 Pro 5G", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai alt pro" },
  { message: "หาเคส reno16 pro", expectedModel: "OPPO Reno16 Pro 5G", notes: "accessories mention with pro" },
  { message: "สนใจ reno16 pro 5g ครับ", expectedModel: "OPPO Reno16 Pro 5G", notes: "full model name" },
  { message: "reno16pro ผ่อนกี่เดือน", expectedModel: "OPPO Reno16 Pro 5G", expectedDetectionMethod: "COMPACT_ALIAS", notes: "compact no-space pro" },
  { message: "มี Reno 16 Pro ไหมครับ", expectedModel: "OPPO Reno16 Pro 5G", notes: "spaced pro inquiry" },

  // ── FIND X9 (8 cases) ─────────────────────────────────────────────────────
  { message: "Find X9 ราคา", expectedModel: "OPPO Find X9", expectedDetectionMethod: "EXACT_ALIAS", notes: "exact Latin" },
  { message: "มีของ Find X9 ไหม", expectedModel: "OPPO Find X9", notes: "stock inquiry" },
  { message: "ไฟน์เอ็กซ์9 ราคาเท่าไร", expectedModel: "OPPO Find X9", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai phonetic" },
  { message: "ไฟน์ x9 สีดำมีไหม", expectedModel: "OPPO Find X9", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai mixed" },
  { message: "OPPO Find X9 256GB ราคา", expectedModel: "OPPO Find X9", notes: "storage suffix" },
  { message: "findx9 ราคา", expectedModel: "OPPO Find X9", expectedDetectionMethod: "COMPACT_ALIAS", notes: "compact no-space" },
  { message: "สนใจ find x9 ครับ ผ่อนได้ไหม", expectedModel: "OPPO Find X9", notes: "installment + Find X9" },
  { message: "Find X9 เปิดตัวเมื่อไหร่", expectedModel: "OPPO Find X9", notes: "launch date query" },

  // ── A6 PRO 5G (8 cases) ───────────────────────────────────────────────────
  { message: "a6 pro ราคาเท่าไหร่", expectedModel: "OPPO A6 Pro 5G", expectedDetectionMethod: "EXACT_ALIAS", notes: "Latin pro" },
  { message: "Oppo a6 pro มีสีอะไร", expectedModel: "OPPO A6 Pro 5G", notes: "with brand" },
  { message: "ผ่อน oppo a6 pro ได้ไหม", expectedModel: "OPPO A6 Pro 5G", notes: "installment" },
  { message: "a6 pro 5g ราคา", expectedModel: "OPPO A6 Pro 5G", notes: "full suffix" },
  { message: "เอ6โปร สีอะไรบ้าง", expectedModel: "OPPO A6 Pro 5G", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai compact pro" },
  { message: "เอ 6 โปร ผ่อนกี่เดือน", expectedModel: "OPPO A6 Pro 5G", expectedDetectionMethod: "COMPACT_ALIAS", notes: "Thai spaced pro — spaced form resolves via COMPACT_ALIAS in catalog" },
  { message: "สนใจ A6 Pro ครับ", expectedModel: "OPPO A6 Pro 5G", notes: "interest A6 Pro" },
  { message: "A6 Pro 5G กล้องกี่ล้าน", expectedModel: "OPPO A6 Pro 5G", notes: "camera spec" },

  // ── A6 5G (6 cases) ───────────────────────────────────────────────────────
  { message: "a6 5g ราคา", expectedModel: "OPPO A6 5G", expectedDetectionMethod: "EXACT_ALIAS", notes: "exact a6 5g" },
  { message: "OPPO A6 5G สีอะไร", expectedModel: "OPPO A6 5G", notes: "with brand" },
  { message: "oppo a6 ราคาเท่าไหร่", expectedModel: "OPPO A6 5G", notes: "brand context required" },
  { message: "สนใจ OPPO A6 ครับ", expectedModel: "OPPO A6 5G", notes: "brand-scoped a6" },
  { message: "เอ6 ราคา", expectedModel: "OPPO A6 5G", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai compact" },
  { message: "A6 5G ผ่อนได้ไหม", expectedModel: "OPPO A6 5G", notes: "installment" },

  // ── PAD 3 (8 cases) ───────────────────────────────────────────────────────
  { message: "OPPO Pad 3 ราคา", expectedModel: "OPPO Pad 3", expectedDetectionMethod: "EXACT_ALIAS", notes: "brand + model" },
  { message: "Pad 3 ราคาเท่าไหร่", expectedModel: "OPPO Pad 3", notes: "no brand" },
  { message: "แพด3 ราคา", expectedModel: "OPPO Pad 3", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai compact" },
  { message: "แพด 3 มีไหมคะ", expectedModel: "OPPO Pad 3", expectedDetectionMethod: "COMPACT_ALIAS", notes: "Thai spaced — catalog SAFE_COMPACT alias triggers COMPACT_ALIAS" },
  { message: "Pad3 มีสีอะไรบ้าง", expectedModel: "OPPO Pad 3", expectedDetectionMethod: "COMPACT_ALIAS", notes: "compact no-space" },
  { message: "แท็บเล็ต pad 3 ราคา", expectedModel: "OPPO Pad 3", expectedDetectionMethod: "EXACT_ALIAS", notes: "Thai tablet prefix — catalog alias matches exactly" },
  { message: "oppo pad 3 12/256 ราคาเท่าไร", expectedModel: "OPPO Pad 3", notes: "storage suffix" },
  { message: "สนใจ Pad 3 สีชมพู", expectedModel: "OPPO Pad 3", notes: "color inquiry" },

  // ── WATCH X2 (6 cases) ────────────────────────────────────────────────────
  { message: "watch x2 ราคา", expectedModel: "OPPO Watch X2", expectedDetectionMethod: "EXACT_ALIAS", notes: "Latin exact" },
  { message: "OPPO Watch X2 สีอะไร", expectedModel: "OPPO Watch X2", notes: "brand + model" },
  { message: "watchx2 ราคาเท่าไหร่", expectedModel: "OPPO Watch X2", expectedDetectionMethod: "COMPACT_ALIAS", notes: "compact" },
  { message: "นาฬิกา x2 มีไหม", expectedModel: "OPPO Watch X2", expectedDetectionMethod: "PHONETIC_ALIAS", notes: "Thai watch x2" },
  { message: "สนใจ Watch X2 ครับ", expectedModel: "OPPO Watch X2", notes: "interest" },
  { message: "Watch X2 รองรับสายชาร์จอะไร", expectedModel: "OPPO Watch X2", notes: "charger query" },

  // ── ENCO AIR4 (6 cases) ───────────────────────────────────────────────────
  { message: "Enco Air4 ราคา", expectedModel: "OPPO Enco Air4", notes: "exact model" },
  { message: "enco air 4 สีขาวมีไหม", expectedModel: "OPPO Enco Air4", expectedDetectionMethod: "EXACT_ALIAS", notes: "spaced variant" },
  { message: "EncoAir4 ราคา", expectedModel: "OPPO Enco Air4", expectedDetectionMethod: "COMPACT_ALIAS", notes: "compact no-space" },
  { message: "หูฟัง enco air4 มีไหมคะ", expectedModel: "OPPO Enco Air4", expectedDetectionMethod: "EXACT_ALIAS", notes: "Thai prefix — catalog has this as SAFE_COMPACT alias, matches exactly" },
  { message: "หูฟัง enco air 4 ราคา", expectedModel: "OPPO Enco Air4", expectedDetectionMethod: "EXACT_ALIAS", notes: "Thai spaced — catalog SAFE_COMPACT alias matches exactly" },
  { message: "Enco Air4 ใส่กับ iPhone ได้ไหม", expectedModel: "OPPO Enco Air4", notes: "compatibility query" },

  // ── ACCESSORIES (8 cases) ─────────────────────────────────────────────────
  // Business rule: specific device models in accessory queries identify the device model
  { message: "oppo case reno16 pro สีดำ", expectedModel: "OPPO Reno16 Pro 5G", notes: "oppo case with specific model" },
  { message: "เคส reno ราคา", expectedModel: "OPPO Case", expectedDetectionMethod: "SERIES_MATCH", notes: "case accessory generic" },
  { message: "เคส a6 ราคา", expectedModel: "OPPO Case", expectedDetectionMethod: "SERIES_MATCH", notes: "a6 case generic" },
  { message: "ฟิล์ม a6 pro ราคา", expectedModel: "OPPO A6 Pro 5G", notes: "film accessory with specific model" },
  { message: "หัวชาร์จ supervooc ราคา", expectedModel: "OPPO Charger", expectedDetectionMethod: "SERIES_MATCH", notes: "charger" },
  { message: "สายชาร์จ oppo reno16 ราคาเท่าไหร่", expectedModel: "OPPO Reno16", notes: "charging cable with specific model" },
  { message: "oppo charger ราคา", expectedModel: "OPPO Charger", notes: "charger generic" },
  { message: "ที่ชาร์จ oppo ราคา", expectedModel: "OPPO Charger", expectedDetectionMethod: "SERIES_MATCH", notes: "Thai charger" },

  // ── SERIES/GENERIC (10 cases) ─────────────────────────────────────────────
  { message: "มือถือ oppo ราคาถูก", expectedModel: "OPPO Smartphone", expectedDetectionMethod: "SERIES_MATCH", notes: "generic phone" },
  { message: "โทรศัพท์ oppo รุ่นใหม่", expectedModel: "OPPO Smartphone", expectedDetectionMethod: "SERIES_MATCH", notes: "new models" },
  { message: "ขอแนะนำ oppo smartphone", expectedModel: "OPPO Smartphone", expectedDetectionMethod: "SERIES_MATCH", notes: "recommendation — use catalog alias" },
  { message: "OPPO Reno Series มีอะไรบ้าง", expectedModel: "OPPO Reno Series", expectedDetectionMethod: "SERIES_MATCH", notes: "series inquiry" },
  { message: "Find Series ราคาเท่าไหร่", expectedModel: "OPPO Find Series", expectedDetectionMethod: "SERIES_MATCH", notes: "find series" },
  { message: "oppo pad มีรุ่นอะไรบ้าง", expectedModel: "OPPO Pad Series", expectedDetectionMethod: "SERIES_MATCH", notes: "pad series" },
  { message: "หูฟัง oppo enco มีไหม", expectedModel: "OPPO Enco Series", expectedDetectionMethod: "SERIES_MATCH", notes: "enco series" },
  { message: "oppo watch มีรุ่นอะไร", expectedModel: "OPPO Watch Series", expectedDetectionMethod: "SERIES_MATCH", notes: "watch series" },
  { message: "OPPO TV ราคา", expectedModel: "OPPO TV", expectedDetectionMethod: "SERIES_MATCH", notes: "TV generic" },
  { message: "กล้อง oppo ราคา", expectedModel: "OPPO Smart Camera", expectedDetectionMethod: "SERIES_MATCH", notes: "smart camera" },

  // ── FALSE POSITIVES — must NOT match (10 cases) ───────────────────────────
  { message: "สนใจ a6", expectedModel: null, notes: "bare a6 — ambiguous, no brand context" },
  { message: "A6", expectedModel: null, notes: "bare A6 token alone" },
  { message: "renovation project ราคาเท่าไหร่", expectedModel: null, notes: "renovation != reno" },
  { message: "smartwatch ราคาเท่าไหร่", expectedModel: null, notes: "generic smartwatch — no OPPO brand" },
  { message: "ทีวี ราคาถูก", expectedModel: null, notes: "generic TV — no brand" },
  { message: "เราเตอร์ tp-link", expectedModel: null, notes: "third-party router" },
  { message: "apple watch ราคา", expectedModel: null, notes: "competitor brand watch" },
  { message: "Samsung TV ราคา", expectedModel: null, notes: "competitor brand TV" },
  { message: "notepad ใช้ยังไง", expectedModel: null, notes: "notepad != pad" },
  { message: "เครื่องเสีย ซ่อมไหม", expectedModel: null, notes: "device repair — no product match" },

  // ── EDGE / DISAMBIGUATION (10 cases) ─────────────────────────────────────
  { message: "reno16 vs reno16 pro อันไหนดี", expectedModel: "OPPO Reno16 Pro 5G", notes: "when both mentioned, higher-priority Pro wins" },
  { message: "Reno16 12+256 สีน้ำตาล ราคา", expectedModel: "OPPO Reno16", notes: "base with storage spec — no Pro" },
  { message: "A6 Pro กับ Reno16 Pro อันไหนดี", expectedModel: "OPPO Reno16 Pro 5G", notes: "higher catalog priority wins (Reno16 Pro priority=120 vs A6 Pro priority=120, Reno16 Pro wins by last message sentAt or higher)" },
  { message: "find x9 pro ราคา", expectedModel: null, notes: "Find X9 Pro does not exist in catalog — suffix guard rejects it" },
  { message: "reno16 ultra", expectedModel: null, notes: "Reno16 Ultra not in catalog — suffix guard" },
  { message: "a6 pro ultra", expectedModel: null, notes: "A6 Pro Ultra not in catalog" },
  { message: "ขอบคุณครับ", expectedModel: null, notes: "greeting — no product" },
  { message: "สวัสดีครับ สนใจซื้อสินค้า", expectedModel: null, notes: "greeting with intent but no product named" },
  { message: "oppo smartphone ราคา", expectedModel: "OPPO Smartphone", expectedDetectionMethod: "SERIES_MATCH", notes: "generic oppo product via catalog alias" },
  { message: "Reno 16 Pro 5G ผ่อนดาวน์กี่บาท", expectedModel: "OPPO Reno16 Pro 5G", notes: "full spaced model name + 5G" },
];
