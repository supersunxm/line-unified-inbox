import { TranslationTargetLanguage } from "../dto/create-message-translation.dto";

export type OppoRetailGlossaryCategory = "product" | "technology" | "retail";

export type OppoRetailGlossaryEntry = {
  term: string;
  category: OppoRetailGlossaryCategory;
  sourceAliases: string[];
  acceptedTargets: Record<TranslationTargetLanguage, string[]>;
  preserveVerbatim: boolean;
};

const protectedName = (term: string, sourceAliases: string[] = [term]): OppoRetailGlossaryEntry => ({
  term,
  category: "product",
  sourceAliases,
  acceptedTargets: { en: [term], zh: [term] },
  preserveVerbatim: true,
});

const protectedTechnology = (term: string): OppoRetailGlossaryEntry => ({
  term,
  category: "technology",
  sourceAliases: [term],
  acceptedTargets: { en: [term], zh: [term] },
  preserveVerbatim: true,
});

const retailConcept = (term: string, sourceAliases: string[], en: string[], zh: string[]): OppoRetailGlossaryEntry => ({
  term,
  category: "retail",
  sourceAliases,
  acceptedTargets: { en, zh },
  preserveVerbatim: false,
});

export const OPPO_RETAIL_TRANSLATION_GLOSSARY: OppoRetailGlossaryEntry[] = [
  protectedName("OPPO", ["OPPO", "ออปโป้", "ออปโป"]),
  protectedName("Find X9 Pro"),
  protectedName("Find X9 Ultra"),
  protectedName("Reno16"),
  protectedName("Reno16 Pro"),
  protectedName("OPPO Pad", ["OPPO Pad", "ออปโป้ แพด"]),
  protectedName("OPPO Watch", ["OPPO Watch", "ออปโป้ วอทช์"]),
  protectedTechnology("ColorOS"),
  protectedTechnology("SUPERVOOC"),
  protectedTechnology("AirVOOC"),
  protectedTechnology("AI Eraser"),
  protectedTechnology("AI Studio"),
  protectedTechnology("UFS"),
  protectedTechnology("AMOLED"),
  retailConcept("installment", ["installment", "ผ่อน", "ผ่อนได้"], ["installment", "installments"], ["分期", "分期付款"]),
  retailConcept("down payment", ["down payment", "ดาวน์", "เงินดาวน์"], ["down payment"], ["首付", "首付款"]),
  retailConcept("promotion", ["promotion", "โปรโมชั่น", "โปร"], ["promotion", "promotions", "offer"], ["促销", "优惠", "活动"]),
  retailConcept("stock", ["stock", "มีของ", "ของไหม", "สินค้า"], ["stock", "available", "availability"], ["现货", "有货", "库存"]),
  retailConcept("warranty", ["warranty", "ประกัน", "รับประกัน"], ["warranty", "guarantee"], ["保修", "质保"]),
  retailConcept("repair", ["repair", "ซ่อม", "ส่งซ่อม"], ["repair", "service"], ["维修", "修理"]),
  retailConcept("pickup", ["pickup", "รับที่ร้าน", "ไปรับ"], ["pickup", "pick up", "pick it up", "collect"], ["取货", "自取", "领取"]),
  retailConcept("trade-in", ["trade-in", "trade in", "เทิร์น", "แลกเครื่อง"], ["trade-in", "trade in"], ["以旧换新", "折抵"]),
];

function normalized(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase();
}

export function glossaryEntriesForSource(sourceText: string) {
  const source = normalized(sourceText);
  return OPPO_RETAIL_TRANSLATION_GLOSSARY.filter((entry) => entry.sourceAliases.some((alias) => source.includes(normalized(alias))));
}

export function glossaryTargetPreserved(output: string, targetLanguage: TranslationTargetLanguage, entry: OppoRetailGlossaryEntry) {
  if (entry.preserveVerbatim) return entry.acceptedTargets[targetLanguage].some((target) => output.includes(target));
  const normalizedOutput = normalized(output);
  return entry.acceptedTargets[targetLanguage].some((target) => normalizedOutput.includes(normalized(target)));
}
