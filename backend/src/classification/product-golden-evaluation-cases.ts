/**
 * Product Golden Evaluation Dataset (Frozen Benchmark)
 *
 * Independent evaluation set with 160+ realistic customer messages from OPPO Thailand LINE OA.
 * Defined strictly according to BUSINESS MEANING, independent of matcher quirks.
 *
 * Categories:
 *   - SMARTPHONE: Reno16, Reno16 Pro / 5G, Find X9, A6 5G, A6 Pro 5G
 *   - TABLET: Pad 3
 *   - WEARABLE: Watch X2
 *   - AUDIO: Enco Air4
 *   - ACCESSORIES WITH DEVICE: "เคส Reno16", "ฟิล์ม Find X9" → maps to the Phone Model (accessory intent is handled by Topic classifier)
 *   - GENERIC BRAND / ACCESSORY: "เคส oppo", "ที่ชาร์จ oppo", "โทรศัพท์ oppo"
 *   - FALSE POSITIVES / COMPETITORS: "16 pro max", "watch youtube", "pad thai", competitor brands, ambiguous "a6"
 *
 * expectedModel:
 *   - Canonical ProductModel name string (e.g. "OPPO Reno16", "OPPO Reno16 Pro 5G")
 *   - null: indicates "NO OPPO PRODUCT MATCH" (for false positives, non-OPPO, or ambiguous queries without brand context)
 */

export type GoldenEvaluationCategory =
  | "RENO16_BASE"
  | "RENO16_PRO"
  | "FIND_X9"
  | "A6_5G"
  | "A6_PRO_5G"
  | "PAD_3"
  | "WATCH_X2"
  | "ENCO_AIR4"
  | "ACCESSORY_WITH_DEVICE"
  | "GENERIC_OPPO"
  | "FALSE_POSITIVES";

export type GoldenEvaluationCase = {
  id: string;
  category: GoldenEvaluationCategory;
  message: string;
  expectedModel: string | null;
  description: string;
};

export const GOLDEN_EVALUATION_CASES: GoldenEvaluationCase[] = [
  // ── 1. RENO16 BASE (18 cases) ───────────────────────────────────────────
  { id: "reno16-01", category: "RENO16_BASE", message: "reno16 ราคาเท่าไหร่", expectedModel: "OPPO Reno16", description: "Standard lowercase exact" },
  { id: "reno16-02", category: "RENO16_BASE", message: "Reno 16 มีสีอะไรบ้างคะ", expectedModel: "OPPO Reno16", description: "Spaced model name" },
  { id: "reno16-03", category: "RENO16_BASE", message: "รีโน16 ราคา", expectedModel: "OPPO Reno16", description: "Thai phonetic compact" },
  { id: "reno16-04", category: "RENO16_BASE", message: "สนใจ รีโน 16 สีดำ", expectedModel: "OPPO Reno16", description: "Thai phonetic spaced" },
  { id: "reno16-05", category: "RENO16_BASE", message: "เรโน 16 ผ่อน 0% ได้ไหม", expectedModel: "OPPO Reno16", description: "Thai alternative phonetic spelling" },
  { id: "reno16-06", category: "RENO16_BASE", message: "มีโปรผ่อน reno16 ไหม", expectedModel: "OPPO Reno16", description: "Promo query with base model" },
  { id: "reno16-07", category: "RENO16_BASE", message: "Reno16f/128GB 0653706220", expectedModel: "OPPO Reno16", description: "Model variant F with storage and phone number" },
  { id: "reno16-08", category: "RENO16_BASE", message: "0895888501 Reno 16 5g", expectedModel: "OPPO Reno16", description: "Phone number prefix with Reno 16 5g" },
  { id: "reno16-09", category: "RENO16_BASE", message: "Reno16 5g สีทองมีของไหม", expectedModel: "OPPO Reno16", description: "Reno16 5g stock inquiry" },
  { id: "reno16-10", category: "RENO16_BASE", message: "รีโน16 5g ราคาเท่าไหร่", expectedModel: "OPPO Reno16", description: "Thai phonetic with 5g suffix" },
  { id: "reno16-11", category: "RENO16_BASE", message: "Reno 16f 256gb", expectedModel: "OPPO Reno16", description: "F variant with storage" },
  { id: "reno16-12", category: "RENO16_BASE", message: "รีโน16f มีสีอะไรบ้าง", expectedModel: "OPPO Reno16", description: "Thai phonetic F variant" },
  { id: "reno16-13", category: "RENO16_BASE", message: "OPPO Reno16 กล้องสวยไหม", expectedModel: "OPPO Reno16", description: "Brand + model name" },
  { id: "reno16-14", category: "RENO16_BASE", message: "เรโน16 5g ผ่อนกี่เดือน", expectedModel: "OPPO Reno16", description: "Thai phonetic 5g installment" },
  { id: "reno16-15", category: "RENO16_BASE", message: "reno 16 f สีม่วง", expectedModel: "OPPO Reno16", description: "Spaced F variant with color" },
  { id: "reno16-16", category: "RENO16_BASE", message: "จอง Reno 16 1 เครื่อง", expectedModel: "OPPO Reno16", description: "Reservation inquiry" },
  { id: "reno16-17", category: "RENO16_BASE", message: "reno16 8/256GB ราคาล่าสุด", expectedModel: "OPPO Reno16", description: "RAM/ROM spec suffix" },
  { id: "reno16-18", category: "RENO16_BASE", message: "ออปโป้ reno 16 มีของแถมไหม", expectedModel: "OPPO Reno16", description: "Thai brand prefix with model" },

  // ── 2. RENO16 PRO / 5G (18 cases) ───────────────────────────────────────
  { id: "reno16pro-01", category: "RENO16_PRO", message: "reno16 pro ราคาเท่าไหร่", expectedModel: "OPPO Reno16 Pro 5G", description: "Standard lowercase pro" },
  { id: "reno16pro-02", category: "RENO16_PRO", message: "Reno16 Pro 512", expectedModel: "OPPO Reno16 Pro 5G", description: "Pro with 512GB spec" },
  { id: "reno16pro-03", category: "RENO16_PRO", message: "รีโน16โปรเท่าไหร่", expectedModel: "OPPO Reno16 Pro 5G", description: "Thai phonetic compact with price query" },
  { id: "reno16pro-04", category: "RENO16_PRO", message: "รีโน 16 โปร สีขาวมีไหม", expectedModel: "OPPO Reno16 Pro 5G", description: "Thai phonetic spaced pro" },
  { id: "reno16pro-05", category: "RENO16_PRO", message: "เรโน16โปร มีของไหมคะ", expectedModel: "OPPO Reno16 Pro 5G", description: "Thai phonetic alt spelling pro" },
  { id: "reno16pro-06", category: "RENO16_PRO", message: "reno16pro ผ่อน 0% 10 เดือน", expectedModel: "OPPO Reno16 Pro 5G", description: "Compact no-space pro installment" },
  { id: "reno16pro-07", category: "RENO16_PRO", message: "สนใจ Reno16 Pro 5g ครับ", expectedModel: "OPPO Reno16 Pro 5G", description: "Full model name with 5G" },
  { id: "reno16pro-08", category: "RENO16_PRO", message: "Reno 16 Pro 5G 12/512GB ราคา", expectedModel: "OPPO Reno16 Pro 5G", description: "Full spaced name with RAM/ROM" },
  { id: "reno16pro-09", category: "RENO16_PRO", message: "รีโน16 pro มีสีอะไรบ้าง", expectedModel: "OPPO Reno16 Pro 5G", description: "Mixed Thai-English pro" },
  { id: "reno16pro-10", category: "RENO16_PRO", message: "เรโน 16 โปร 5g ราคา", expectedModel: "OPPO Reno16 Pro 5G", description: "Full Thai phonetic with 5g" },
  { id: "reno16pro-11", category: "RENO16_PRO", message: "0812345678 สนใจ Reno16 Pro", expectedModel: "OPPO Reno16 Pro 5G", description: "Phone number with Reno16 Pro" },
  { id: "reno16pro-12", category: "RENO16_PRO", message: "reno16pro5g มีสีเงินไหม", expectedModel: "OPPO Reno16 Pro 5G", description: "Compact full alphanumeric" },
  { id: "reno16pro-13", category: "RENO16_PRO", message: "OPPO Reno 16 Pro กล้องเทเลดีไหม", expectedModel: "OPPO Reno16 Pro 5G", description: "Brand with spaced Pro" },
  { id: "reno16pro-14", category: "RENO16_PRO", message: "reno 16pro ราคาโปรโมชั่น", expectedModel: "OPPO Reno16 Pro 5G", description: "Mixed spacing reno 16pro" },
  { id: "reno16pro-15", category: "RENO16_PRO", message: "อยากได้ รีโน 16 โปร สีดำ", expectedModel: "OPPO Reno16 Pro 5G", description: "Desire query with Thai pro" },
  { id: "reno16pro-16", category: "RENO16_PRO", message: "reno16 vs reno16 pro อันไหนดี", expectedModel: "OPPO Reno16 Pro 5G", description: "Comparison query — higher priority Pro wins" },
  { id: "reno16pro-17", category: "RENO16_PRO", message: "รีโน16โปร 512gb พร้อมรับเครื่อง", expectedModel: "OPPO Reno16 Pro 5G", description: "Thai pro with storage and intent" },
  { id: "reno16pro-18", category: "RENO16_PRO", message: "มีโปร Reno 16 Pro ย้ายค่ายไหม", expectedModel: "OPPO Reno16 Pro 5G", description: "Carrier switch promotion with Reno 16 Pro" },

  // ── 3. FIND X9 (16 cases) ────────────────────────────────────────────────
  { id: "findx9-01", category: "FIND_X9", message: "Find X9 ราคา", expectedModel: "OPPO Find X9", description: "Standard exact Find X9" },
  { id: "findx9-02", category: "FIND_X9", message: "find x9 256GB มีของไหม", expectedModel: "OPPO Find X9", description: "Find X9 with storage" },
  { id: "findx9-03", category: "FIND_X9", message: "ไฟน์เอ็กซ์9 ราคาเท่าไหร่", expectedModel: "OPPO Find X9", description: "Thai phonetic Find X9" },
  { id: "findx9-04", category: "FIND_X9", message: "ไฟน์ x9 สีดำมีไหม", expectedModel: "OPPO Find X9", description: "Mixed Thai-English Find X9" },
  { id: "findx9-05", category: "FIND_X9", message: "findx9 ผ่อนกี่เดือน", expectedModel: "OPPO Find X9", description: "Compact no-space findx9" },
  { id: "findx9-06", category: "FIND_X9", message: "OPPO Find X9 เข้าไทยเมื่อไหร่", expectedModel: "OPPO Find X9", description: "Brand + Find X9" },
  { id: "findx9-07", category: "FIND_X9", message: "ไฟน์เอ็กซ์ 9 มีโปรโมชั่นอะไรบ้าง", expectedModel: "OPPO Find X9", description: "Spaced Thai phonetic" },
  { id: "findx9-08", category: "FIND_X9", message: "สนใจ find x9 512gb ครับ", expectedModel: "OPPO Find X9", description: "Interest with storage" },
  { id: "findx9-09", category: "FIND_X9", message: "0998765432 จอง Find X9", expectedModel: "OPPO Find X9", description: "Phone number with reservation" },
  { id: "findx9-10", category: "FIND_X9", message: "ไฟน์x9 สีขาว มีของไหม", expectedModel: "OPPO Find X9", description: "Compact Thai-English" },
  { id: "findx9-11", category: "FIND_X9", message: "oppo find x9 ราคาเท่าไร", expectedModel: "OPPO Find X9", description: "Full lowercase brand + model" },
  { id: "findx9-12", category: "FIND_X9", message: "Find X9 กล้อง hasselblad ไหม", expectedModel: "OPPO Find X9", description: "Feature inquiry" },
  { id: "findx9-13", category: "FIND_X9", message: "ผ่อน Find X9 0% บัตรกสิกร", expectedModel: "OPPO Find X9", description: "Bank installment query" },
  { id: "findx9-14", category: "FIND_X9", message: "ไฟน์ เอ็กซ์ 9 ราคาศูนย์", expectedModel: "OPPO Find X9", description: "Multi-spaced Thai phonetic" },
  { id: "findx9-15", category: "FIND_X9", message: "find x9 trade in ได้เท่าไหร่", expectedModel: "OPPO Find X9", description: "Trade-in inquiry" },
  { id: "findx9-16", category: "FIND_X9", message: "ออปโป้ find x9 มีสีอะไรบ้าง", expectedModel: "OPPO Find X9", description: "Thai brand prefix with Find X9" },

  // ── 4. A6 5G (14 cases) ──────────────────────────────────────────────────
  { id: "a6-5g-01", category: "A6_5G", message: "a6 5g ราคา", expectedModel: "OPPO A6 5G", description: "Standard a6 5g" },
  { id: "a6-5g-02", category: "A6_5G", message: "a65g มีสีอะไรบ้าง", expectedModel: "OPPO A6 5G", description: "Compact a65g" },
  { id: "a6-5g-03", category: "A6_5G", message: "oppo a6 ราคาเท่าไหร่", expectedModel: "OPPO A6 5G", description: "Brand-scoped oppo a6" },
  { id: "a6-5g-04", category: "A6_5G", message: "เอ6 5g ราคา", expectedModel: "OPPO A6 5G", description: "Thai phonetic with 5g" },
  { id: "a6-5g-05", category: "A6_5G", message: "เอ 6 5g มีของไหม", expectedModel: "OPPO A6 5G", description: "Thai phonetic spaced with 5g" },
  { id: "a6-5g-06", category: "A6_5G", message: "เอ6 ราคาเท่าไหร่", expectedModel: "OPPO A6 5G", description: "Thai phonetic เอ6" },
  { id: "a6-5g-07", category: "A6_5G", message: "สนใจ OPPO A6 5G ครับ", expectedModel: "OPPO A6 5G", description: "Brand + A6 5G" },
  { id: "a6-5g-08", category: "A6_5G", message: "0861112233 สั่งซื้อ A6 5G", expectedModel: "OPPO A6 5G", description: "Phone number with A6 5G" },
  { id: "a6-5g-09", category: "A6_5G", message: "A6 5G 128GB ผ่อนได้ไหม", expectedModel: "OPPO A6 5G", description: "A6 5G with storage" },
  { id: "a6-5g-10", category: "A6_5G", message: "ออปโป้ A6 5g มีสีฟ้าไหม", expectedModel: "OPPO A6 5G", description: "Thai brand with A6 5G" },
  { id: "a6-5g-11", category: "A6_5G", message: "oppo a6 128gb", expectedModel: "OPPO A6 5G", description: "Brand oppo a6 with storage" },
  { id: "a6-5g-12", category: "A6_5G", message: "เอ6 5g แบตอึดไหม", expectedModel: "OPPO A6 5G", description: "Battery query with Thai A6 5G" },
  { id: "a6-5g-13", category: "A6_5G", message: "a6 5g พร้อมโปรเปิดเบอร์", expectedModel: "OPPO A6 5G", description: "Carrier bundle query" },
  { id: "a6-5g-14", category: "A6_5G", message: "Oppo A6 5G สีดำ", expectedModel: "OPPO A6 5G", description: "Mixed case with color" },

  // ── 5. A6 PRO 5G (14 cases) ──────────────────────────────────────────────
  { id: "a6pro-01", category: "A6_PRO_5G", message: "a6 pro ราคาเท่าไหร่", expectedModel: "OPPO A6 Pro 5G", description: "Standard a6 pro" },
  { id: "a6pro-02", category: "A6_PRO_5G", message: "a6pro 5g มีสีอะไร", expectedModel: "OPPO A6 Pro 5G", description: "Compact with 5g" },
  { id: "a6pro-03", category: "A6_PRO_5G", message: "Oppo a6 pro ผ่อนได้ไหม", expectedModel: "OPPO A6 Pro 5G", description: "Brand with a6 pro" },
  { id: "a6pro-04", category: "A6_PRO_5G", message: "เอ6โปร ราคาเท่าไหร่", expectedModel: "OPPO A6 Pro 5G", description: "Thai phonetic compact pro" },
  { id: "a6pro-05", category: "A6_PRO_5G", message: "เอ 6 โปร มีของไหมคะ", expectedModel: "OPPO A6 Pro 5G", description: "Thai phonetic spaced pro" },
  { id: "a6pro-06", category: "A6_PRO_5G", message: "a6 pro 5g 256GB ราคา", expectedModel: "OPPO A6 Pro 5G", description: "Full model name with storage" },
  { id: "a6pro-07", category: "A6_PRO_5G", message: "a6pro ผ่อน 0% กี่เดือน", expectedModel: "OPPO A6 Pro 5G", description: "Compact a6pro installment" },
  { id: "a6pro-08", category: "A6_PRO_5G", message: "สนใจ A6 Pro สีทอง", expectedModel: "OPPO A6 Pro 5G", description: "Capitalized with color" },
  { id: "a6pro-09", category: "A6_PRO_5G", message: "เอ6 pro 5g มีสีอะไรบ้าง", expectedModel: "OPPO A6 Pro 5G", description: "Mixed Thai-English A6 pro" },
  { id: "a6pro-10", category: "A6_PRO_5G", message: "0912233445 สอบถาม A6 Pro", expectedModel: "OPPO A6 Pro 5G", description: "Phone number with A6 Pro" },
  { id: "a6pro-11", category: "A6_PRO_5G", message: "OPPO A6 Pro 5G กล้องกี่ล้าน", expectedModel: "OPPO A6 Pro 5G", description: "Brand + full model name" },
  { id: "a6pro-12", category: "A6_PRO_5G", message: "เอ 6 pro สีดำ", expectedModel: "OPPO A6 Pro 5G", description: "Spaced Thai-English" },
  { id: "a6pro-13", category: "A6_PRO_5G", message: "a6 pro ชาร์จไวกี่วัตต์", expectedModel: "OPPO A6 Pro 5G", description: "Charging spec query" },
  { id: "a6pro-14", category: "A6_PRO_5G", message: "รีวิว a6 pro หน่อยครับ", expectedModel: "OPPO A6 Pro 5G", description: "Review inquiry" },

  // ── 6. PAD 3 (12 cases) ──────────────────────────────────────────────────
  { id: "pad3-01", category: "PAD_3", message: "Pad 3 ราคาเท่าไหร่", expectedModel: "OPPO Pad 3", description: "Standard Pad 3" },
  { id: "pad3-02", category: "PAD_3", message: "OPPO Pad 3 มีสีอะไร", expectedModel: "OPPO Pad 3", description: "Brand + Pad 3" },
  { id: "pad3-03", category: "PAD_3", message: "แพด3 ราคา", expectedModel: "OPPO Pad 3", description: "Thai phonetic compact" },
  { id: "pad3-04", category: "PAD_3", message: "แพด 3 มีของไหมคะ", expectedModel: "OPPO Pad 3", description: "Thai phonetic spaced" },
  { id: "pad3-05", category: "PAD_3", message: "pad3 12/256GB ผ่อนได้ไหม", expectedModel: "OPPO Pad 3", description: "Compact no-space with spec" },
  { id: "pad3-06", category: "PAD_3", message: "แท็บเล็ต pad 3 ราคา", expectedModel: "OPPO Pad 3", description: "Tablet descriptor with Pad 3" },
  { id: "pad3-07", category: "PAD_3", message: "สนใจ Pad 3 แถมปากกาไหม", expectedModel: "OPPO Pad 3", description: "Stylus bundle query" },
  { id: "pad3-08", category: "PAD_3", message: "oppo pad 3 wifi หรือใส่ซิม", expectedModel: "OPPO Pad 3", description: "Connectivity query" },
  { id: "pad3-09", category: "PAD_3", message: "แพด3 สีเทา มีโปรโมชั่นไหม", expectedModel: "OPPO Pad 3", description: "Thai phonetic with promo" },
  { id: "pad3-10", category: "PAD_3", message: "0845566778 สั่ง Pad 3", expectedModel: "OPPO Pad 3", description: "Phone number with Pad 3" },
  { id: "pad3-11", category: "PAD_3", message: "แท็บเล็ตแพด 3 ราคาศูนย์", expectedModel: "OPPO Pad 3", description: "Full Thai tablet query" },
  { id: "pad3-12", category: "PAD_3", message: "Pad 3 ใส่คีย์บอร์ดได้ไหม", expectedModel: "OPPO Pad 3", description: "Keyboard accessory query" },

  // ── 7. WATCH X2 (10 cases) ───────────────────────────────────────────────
  { id: "watchx2-01", category: "WATCH_X2", message: "watch x2 ราคา", expectedModel: "OPPO Watch X2", description: "Standard watch x2" },
  { id: "watchx2-02", category: "WATCH_X2", message: "OPPO Watch X2 มีสีอะไร", expectedModel: "OPPO Watch X2", description: "Brand + watch x2" },
  { id: "watchx2-03", category: "WATCH_X2", message: "watchx2 ราคาเท่าไหร่", expectedModel: "OPPO Watch X2", description: "Compact watchx2" },
  { id: "watchx2-04", category: "WATCH_X2", message: "นาฬิกา x2 มีของไหม", expectedModel: "OPPO Watch X2", description: "Thai watch x2" },
  { id: "watchx2-05", category: "WATCH_X2", message: "สนใจ Watch X2 สายหนัง", expectedModel: "OPPO Watch X2", description: "Strap inquiry" },
  { id: "watchx2-06", category: "WATCH_X2", message: "watch x2 ใส่ซิมได้ไหม", expectedModel: "OPPO Watch X2", description: "eSIM inquiry" },
  { id: "watchx2-07", category: "WATCH_X2", message: "0834455667 จอง Watch X2", expectedModel: "OPPO Watch X2", description: "Phone number with Watch X2" },
  { id: "watchx2-08", category: "WATCH_X2", message: "นาฬิกา oppo watch x2 ราคา", expectedModel: "OPPO Watch X2", description: "Full Thai + brand watch" },
  { id: "watchx2-09", category: "WATCH_X2", message: "Watch X2 แบตกี่วัน", expectedModel: "OPPO Watch X2", description: "Battery life query" },
  { id: "watchx2-10", category: "WATCH_X2", message: "ผ่อน watch x2 0%", expectedModel: "OPPO Watch X2", description: "Installment query" },

  // ── 8. ENCO AIR4 (10 cases) ──────────────────────────────────────────────
  { id: "encoair4-01", category: "ENCO_AIR4", message: "Enco Air4 ราคา", expectedModel: "OPPO Enco Air4", description: "Standard Enco Air4" },
  { id: "encoair4-02", category: "ENCO_AIR4", message: "enco air 4 สีขาวมีไหม", expectedModel: "OPPO Enco Air4", description: "Spaced enco air 4" },
  { id: "encoair4-03", category: "ENCO_AIR4", message: "EncoAir4 ราคาเท่าไหร่", expectedModel: "OPPO Enco Air4", description: "Compact EncoAir4" },
  { id: "encoair4-04", category: "ENCO_AIR4", message: "หูฟัง enco air4 มีไหมคะ", expectedModel: "OPPO Enco Air4", description: "Thai prefix with compact air4" },
  { id: "encoair4-05", category: "ENCO_AIR4", message: "หูฟัง enco air 4 ราคา", expectedModel: "OPPO Enco Air4", description: "Thai prefix with spaced air 4" },
  { id: "encoair4-06", category: "ENCO_AIR4", message: "หูฟัง enco air สีดำ", expectedModel: "OPPO Enco Air4", description: "Thai prefix enco air" },
  { id: "encoair4-07", category: "ENCO_AIR4", message: "OPPO Enco Air 4 ตัดเสียงรบกวนไหม", expectedModel: "OPPO Enco Air4", description: "ANC feature inquiry" },
  { id: "encoair4-08", category: "ENCO_AIR4", message: "enco air4 เชื่อมไอโฟนได้ไหม", expectedModel: "OPPO Enco Air4", description: "Compatibility query" },
  { id: "encoair4-09", category: "ENCO_AIR4", message: "0891122334 สั่ง Enco Air 4", expectedModel: "OPPO Enco Air4", description: "Phone number with Enco Air 4" },
  { id: "encoair4-10", category: "ENCO_AIR4", message: "oppo enco air4 ราคาโปรโมชั่น", expectedModel: "OPPO Enco Air4", description: "Full brand enco air4" },

  // ── 9. ACCESSORY WITH SPECIFIC DEVICE (12 cases) ─────────────────────────
  // Business rule: Product should identify the Phone/Tablet Model, Topic identifies Case/Film/Charger
  { id: "acc-dev-01", category: "ACCESSORY_WITH_DEVICE", message: "เคส Reno16 มีไหม", expectedModel: "OPPO Reno16", description: "Case inquiry for Reno16" },
  { id: "acc-dev-02", category: "ACCESSORY_WITH_DEVICE", message: "เคส Reno16 Pro สีใส", expectedModel: "OPPO Reno16 Pro 5G", description: "Case inquiry for Reno16 Pro" },
  { id: "acc-dev-03", category: "ACCESSORY_WITH_DEVICE", message: "หาเคส reno16 pro", expectedModel: "OPPO Reno16 Pro 5G", description: "Finding case for Reno16 Pro" },
  { id: "acc-dev-04", category: "ACCESSORY_WITH_DEVICE", message: "ฟิล์มกระจก find x9 ราคา", expectedModel: "OPPO Find X9", description: "Screen protector for Find X9" },
  { id: "acc-dev-05", category: "ACCESSORY_WITH_DEVICE", message: "เคส a6 pro 5g ราคาเท่าไหร่", expectedModel: "OPPO A6 Pro 5G", description: "Case for A6 Pro 5G" },
  { id: "acc-dev-06", category: "ACCESSORY_WITH_DEVICE", message: "ฟิล์ม a6 pro มีไหม", expectedModel: "OPPO A6 Pro 5G", description: "Film for A6 Pro" },
  { id: "acc-dev-07", category: "ACCESSORY_WITH_DEVICE", message: "สายชาร์จ oppo reno16 ราคา", expectedModel: "OPPO Reno16", description: "Charger for Reno16" },
  { id: "acc-dev-08", category: "ACCESSORY_WITH_DEVICE", message: "เคส pad 3 หมุนได้", expectedModel: "OPPO Pad 3", description: "Rotating case for Pad 3" },
  { id: "acc-dev-09", category: "ACCESSORY_WITH_DEVICE", message: "ฟิล์ม รีโน 16 โปร", expectedModel: "OPPO Reno16 Pro 5G", description: "Film for Thai phonetic Reno16 Pro" },
  { id: "acc-dev-10", category: "ACCESSORY_WITH_DEVICE", message: "เคสใส find x9 มีของไหม", expectedModel: "OPPO Find X9", description: "Clear case for Find X9" },
  { id: "acc-dev-11", category: "ACCESSORY_WITH_DEVICE", message: "หัวชาร์จ 67W สำหรับ reno16", expectedModel: "OPPO Reno16", description: "Fast charger for Reno16" },
  { id: "acc-dev-12", category: "ACCESSORY_WITH_DEVICE", message: "เคส oppo a6 5g", expectedModel: "OPPO A6 5G", description: "Case for A6 5G" },

  // ── 10. GENERIC BRAND / SERIES / ACCESSORIES WITHOUT DEVICE (12 cases) ───
  { id: "gen-01", category: "GENERIC_OPPO", message: "เคส oppo ราคาเท่าไหร่", expectedModel: "OPPO Case", description: "Generic OPPO case" },
  { id: "gen-02", category: "GENERIC_OPPO", message: "oppo case สีดำ", expectedModel: "OPPO Case", description: "English OPPO case" },
  { id: "gen-03", category: "GENERIC_OPPO", message: "ที่ชาร์จ oppo ราคา", expectedModel: "OPPO Charger", description: "Generic OPPO charger" },
  { id: "gen-04", category: "GENERIC_OPPO", message: "หัวชาร์จ supervooc ราคา", expectedModel: "OPPO Charger", description: "SuperVOOC charger" },
  { id: "gen-05", category: "GENERIC_OPPO", message: "มือถือ oppo ราคาไม่เกิน 5000", expectedModel: "OPPO Smartphone", description: "Generic OPPO smartphone inquiry" },
  { id: "gen-06", category: "GENERIC_OPPO", message: "โทรศัพท์ oppo รุ่นใหม่ล่าสุด", expectedModel: "OPPO Smartphone", description: "Newest OPPO phone" },
  { id: "gen-07", category: "GENERIC_OPPO", message: "OPPO Reno Series มีรุ่นอะไรบ้าง", expectedModel: "OPPO Reno Series", description: "Reno series query" },
  { id: "gen-08", category: "GENERIC_OPPO", message: "Find Series ราคาเท่าไหร่", expectedModel: "OPPO Find Series", description: "Find series query" },
  { id: "gen-09", category: "GENERIC_OPPO", message: "oppo pad มีรุ่นไหนบ้าง", expectedModel: "OPPO Pad Series", description: "OPPO Pad family" },
  { id: "gen-10", category: "GENERIC_OPPO", message: "หูฟัง oppo enco มีไหม", expectedModel: "OPPO Enco Series", description: "OPPO Enco family" },
  { id: "gen-11", category: "GENERIC_OPPO", message: "oppo watch มีรุ่นอะไรบ้าง", expectedModel: "OPPO Watch Series", description: "OPPO Watch family" },
  { id: "gen-12", category: "GENERIC_OPPO", message: "oppo tv ราคา", expectedModel: "OPPO TV", description: "OPPO TV generic" },

  // ── 11. FALSE POSITIVES / AMBIGUOUS / COMPETITORS (48 cases) ────────────
  // Must return null (NO MATCH)
  { id: "fp-01", category: "FALSE_POSITIVES", message: "16 pro max ราคาเท่าไหร่", expectedModel: null, description: "iPhone 16 Pro Max mention" },
  { id: "fp-02", category: "FALSE_POSITIVES", message: "iPhone 16 Pro Max 256GB", expectedModel: null, description: "Explicit Apple iPhone" },
  { id: "fp-03", category: "FALSE_POSITIVES", message: "iphone 16 pro สีขาว", expectedModel: null, description: "iPhone 16 Pro" },
  { id: "fp-04", category: "FALSE_POSITIVES", message: "watch youtube บนทีวี", expectedModel: null, description: "English verb 'watch'" },
  { id: "fp-05", category: "FALSE_POSITIVES", message: "pad thai อร่อยมาก", expectedModel: null, description: "Thai food 'pad thai'" },
  { id: "fp-06", category: "FALSE_POSITIVES", message: "notepad ใช้ยังไง", expectedModel: null, description: "Notepad text editor" },
  { id: "fp-07", category: "FALSE_POSITIVES", message: "renovation บ้านราคาเท่าไหร่", expectedModel: null, description: "Home renovation" },
  { id: "fp-08", category: "FALSE_POSITIVES", message: "มี a6 ไหม", expectedModel: null, description: "Ambiguous bare a6 without brand context" },
  { id: "fp-09", category: "FALSE_POSITIVES", message: "สนใจ a6 ครับ", expectedModel: null, description: "Ambiguous bare a6" },
  { id: "fp-10", category: "FALSE_POSITIVES", message: "A6", expectedModel: null, description: "Single bare token A6" },
  { id: "fp-11", category: "FALSE_POSITIVES", message: "smartwatch ราคาถูก", expectedModel: null, description: "Generic non-OPPO smartwatch" },
  { id: "fp-12", category: "FALSE_POSITIVES", message: "ทีวี ราคาถูก", expectedModel: null, description: "Generic non-OPPO TV" },
  { id: "fp-13", category: "FALSE_POSITIVES", message: "เราเตอร์ tp-link มีไหม", expectedModel: null, description: "Competitor TP-Link router" },
  { id: "fp-14", category: "FALSE_POSITIVES", message: "apple watch series 9", expectedModel: null, description: "Apple Watch" },
  { id: "fp-15", category: "FALSE_POSITIVES", message: "Samsung Galaxy S24 Ultra", expectedModel: null, description: "Samsung S24 Ultra" },
  { id: "fp-16", category: "FALSE_POSITIVES", message: "galaxy watch 6 ราคา", expectedModel: null, description: "Samsung Galaxy Watch" },
  { id: "fp-17", category: "FALSE_POSITIVES", message: "ipad air 4 64gb", expectedModel: null, description: "Apple iPad Air 4" },
  { id: "fp-18", category: "FALSE_POSITIVES", message: "ipad pro 11 นิ้ว", expectedModel: null, description: "Apple iPad Pro" },
  { id: "fp-19", category: "FALSE_POSITIVES", message: "airpods pro 2 ราคา", expectedModel: null, description: "Apple AirPods Pro" },
  { id: "fp-20", category: "FALSE_POSITIVES", message: "xiaomi router ax3000", expectedModel: null, description: "Xiaomi router" },
  { id: "fp-21", category: "FALSE_POSITIVES", message: "กล้องวงจรปิด ไร้สาย", expectedModel: null, description: "Generic CCTV without brand" },
  { id: "fp-22", category: "FALSE_POSITIVES", message: "power bank 20000mah", expectedModel: null, description: "Generic power bank without brand" },
  { id: "fp-23", category: "FALSE_POSITIVES", message: "สาย type c ทั่วไป", expectedModel: null, description: "Generic Type-C cable" },
  { id: "fp-24", category: "FALSE_POSITIVES", message: "คีย์บอร์ดแท็บเล็ต ทั่วไป", expectedModel: null, description: "Generic tablet keyboard" },
  { id: "fp-25", category: "FALSE_POSITIVES", message: "smart home ทั่วไป", expectedModel: null, description: "Generic smart home" },
  { id: "fp-26", category: "FALSE_POSITIVES", message: "สวัสดีค่ะ", expectedModel: null, description: "Thai greeting" },
  { id: "fp-27", category: "FALSE_POSITIVES", message: "ขอบคุณครับ", expectedModel: null, description: "Thai thank you" },
  { id: "fp-28", category: "FALSE_POSITIVES", message: "ร้านเปิดกี่โมงคะ", expectedModel: null, description: "Store hours inquiry" },
  { id: "fp-29", category: "FALSE_POSITIVES", message: "ส่งโลเคชั่นร้านให้หน่อยครับ", expectedModel: null, description: "Store location inquiry" },
  { id: "fp-30", category: "FALSE_POSITIVES", message: "มีที่จอดรถไหมคะ", expectedModel: null, description: "Parking inquiry" },
  { id: "fp-31", category: "FALSE_POSITIVES", message: "เครื่องเปิดไม่ติด ซ่อมกี่บาท", expectedModel: null, description: "General repair inquiry without model" },
  { id: "fp-32", category: "FALSE_POSITIVES", message: "หน้าจอแตก เคลมประกันได้ไหม", expectedModel: null, description: "Screen warranty inquiry without model" },
  { id: "fp-33", category: "FALSE_POSITIVES", message: "find x9 pro ราคา", expectedModel: null, description: "Non-existent model Find X9 Pro — suffix guard rejects" },
  { id: "fp-34", category: "FALSE_POSITIVES", message: "reno16 ultra มีไหม", expectedModel: null, description: "Non-existent model Reno16 Ultra — suffix guard rejects" },
  { id: "fp-35", category: "FALSE_POSITIVES", message: "a6 pro ultra", expectedModel: null, description: "Non-existent model A6 Pro Ultra — suffix guard rejects" },
  { id: "fp-36", category: "FALSE_POSITIVES", message: "reno16 lite ราคา", expectedModel: null, description: "Non-existent model Reno16 Lite — suffix guard rejects" },
  { id: "fp-37", category: "FALSE_POSITIVES", message: "vivo v30 5g", expectedModel: null, description: "Competitor Vivo phone" },
  { id: "fp-38", category: "FALSE_POSITIVES", message: "realme 12 pro plus", expectedModel: null, description: "Competitor Realme phone" },
  { id: "fp-39", category: "FALSE_POSITIVES", message: "huawei watch gt 4", expectedModel: null, description: "Competitor Huawei watch" },
  { id: "fp-40", category: "FALSE_POSITIVES", message: "honor magic 6 pro", expectedModel: null, description: "Competitor Honor phone" },
  { id: "fp-41", category: "FALSE_POSITIVES", message: "16 pro", expectedModel: null, description: "Bare '16 pro' without Reno/OPPO context" },
  { id: "fp-42", category: "FALSE_POSITIVES", message: "ซื้อของขวัญวันเกิดหน่อย", expectedModel: null, description: "Gift shopping intent without product" },
  { id: "fp-43", category: "FALSE_POSITIVES", message: "แอดมินตอบหน่อยค่ะ", expectedModel: null, description: "Admin nudge" },
  { id: "fp-44", category: "FALSE_POSITIVES", message: "สนใจซื้อมือถือครับ", expectedModel: null, description: "Generic mobile purchase intent without brand" },
  { id: "fp-45", category: "FALSE_POSITIVES", message: "เคสโทรศัพท์สวยๆ", expectedModel: null, description: "Generic phone case without brand" },
  { id: "fp-46", category: "FALSE_POSITIVES", message: "สายชาร์จเร็ว", expectedModel: null, description: "Generic fast charger without brand" },
  { id: "fp-47", category: "FALSE_POSITIVES", message: "หูฟังบลูทูธ เสียงดี", expectedModel: null, description: "Generic bluetooth earbuds without brand" },
  { id: "fp-48", category: "FALSE_POSITIVES", message: "smart watch กันน้ำ", expectedModel: null, description: "Generic waterproof smartwatch without brand" },
];
