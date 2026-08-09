import { ProductAliasSource, ProductGroup } from "@prisma/client";
import { CatalogProductAlias, catalogAlias, isAutoMatchSafety, ProductAliasSafety } from "./product-alias";
import { compactProductText, normalizeProductText, productAliasSafetyIdentity } from "./product-normalization";

export type CatalogAlias = string | CatalogProductAlias;
export type CatalogEntry = { group: ProductGroup; family: string; model: string; level: "MODEL" | "FAMILY" | "GENERIC"; priority: number; aliases: CatalogAlias[] };
export const PRODUCT_CATALOG: CatalogEntry[] = [
  ["SMARTPHONE", "Reno Series", "OPPO Reno16 Pro 5G", "MODEL", 120, [
    catalogAlias("reno16 pro 5g", "SAFE_COMPACT"),
    catalogAlias("reno 16 pro 5g", "SAFE_COMPACT"),
    catalogAlias("reno16pro 5g", "SAFE_COMPACT"),
    catalogAlias("reno16 pro", "SAFE_COMPACT"),
    catalogAlias("reno 16 pro", "SAFE_COMPACT"),
    catalogAlias("reno16pro", "SAFE_COMPACT"),
    catalogAlias("รีโน16โปร", "SAFE_COMPACT", "th"),
    catalogAlias("รีโน 16 โปร", "SAFE_COMPACT", "th"),
    catalogAlias("เรโน16โปร", "SAFE_COMPACT", "th"),
    catalogAlias("เรโน 16 โปร", "SAFE_COMPACT", "th"),
    catalogAlias("รีโน16 pro", "SAFE_COMPACT", "th"),
    catalogAlias("รีโน 16 pro", "SAFE_COMPACT", "th"),
  ]],
  ["SMARTPHONE", "Reno Series", "OPPO Reno16", "MODEL", 110, [
    catalogAlias("reno16", "SAFE_EXACT"),
    catalogAlias("reno 16", "SAFE_EXACT"),
    catalogAlias("reno16 5g", "SAFE_EXACT"),
    catalogAlias("reno 16 5g", "SAFE_EXACT"),
    catalogAlias("reno16f", "SAFE_EXACT"),
    catalogAlias("reno16 f", "SAFE_EXACT"),
    catalogAlias("reno 16f", "SAFE_EXACT"),
    catalogAlias("reno 16 f", "SAFE_EXACT"),
    catalogAlias("รีโน 16", "SAFE_EXACT", "th"),
    catalogAlias("เรโน 16", "SAFE_EXACT", "th"),
    catalogAlias("รีโน16", "SAFE_COMPACT", "th"),
    catalogAlias("เรโน16", "SAFE_COMPACT", "th"),
    catalogAlias("รีโน 16 5g", "SAFE_EXACT", "th"),
    catalogAlias("รีโน16 5g", "SAFE_EXACT", "th"),
    catalogAlias("เรโน 16 5g", "SAFE_EXACT", "th"),
    catalogAlias("เรโน16 5g", "SAFE_EXACT", "th"),
    catalogAlias("รีโน 16 f", "SAFE_EXACT", "th"),
    catalogAlias("รีโน16f", "SAFE_EXACT", "th"),
    catalogAlias("เรโน 16 f", "SAFE_EXACT", "th"),
    catalogAlias("เรโน16f", "SAFE_EXACT", "th"),
  ]],
  ["SMARTPHONE", "A Series", "OPPO A6 Pro 5G", "MODEL", 120, [
    catalogAlias("a6 pro 5g", "SAFE_COMPACT"),
    catalogAlias("a6 pro", "SAFE_COMPACT"),
    catalogAlias("a6pro 5g", "SAFE_COMPACT"),
    catalogAlias("a6pro", "SAFE_COMPACT"),
    catalogAlias("เอ6โปร", "SAFE_COMPACT", "th"),
    catalogAlias("เอ 6 โปร", "SAFE_COMPACT", "th"),
    catalogAlias("เอ6 pro", "SAFE_COMPACT", "th"),
    catalogAlias("เอ 6 pro", "SAFE_COMPACT", "th"),
  ]],
  ["SMARTPHONE", "A Series", "OPPO A6 5G", "MODEL", 110, [
    catalogAlias("a6 5g", "SAFE_COMPACT"),
    catalogAlias("a65g", "SAFE_COMPACT"),
    catalogAlias("oppo a6", "SAFE_EXACT"),
    catalogAlias("เอ6", "SAFE_COMPACT", "th"),
    catalogAlias("เอ6 5g", "SAFE_COMPACT", "th"),
    catalogAlias("เอ 6 5g", "SAFE_COMPACT", "th"),
    catalogAlias("a6", "REVIEW_REQUIRED"),
  ]],
  ["SMARTPHONE", "Find Series", "OPPO Find X9", "MODEL", 120, [
    catalogAlias("find x9", "SAFE_COMPACT"),
    catalogAlias("findx9", "SAFE_COMPACT"),
    catalogAlias("oppo find x9", "SAFE_COMPACT"),
    catalogAlias("ไฟน์เอ็กซ์9", "SAFE_COMPACT", "th"),
    catalogAlias("ไฟน์ x9", "SAFE_COMPACT", "th"),
    catalogAlias("ไฟน์เอ็กซ์ 9", "SAFE_COMPACT", "th"),
    catalogAlias("ไฟน์x9", "SAFE_COMPACT", "th"),
  ]],
  ["SMARTPHONE", "Find Series", "OPPO Find Series", "FAMILY", 60, ["oppo find", "find series", "find x", "find n", "find flip", "find fold", "รุ่นเรือธง", "ไฟน์ซีรีส์"]],
  ["SMARTPHONE", "Reno Series", "OPPO Reno Series", "FAMILY", 60, [catalogAlias("oppo reno", "SAFE_EXACT"), catalogAlias("reno series", "SAFE_EXACT"), catalogAlias("reno", "BLOCKED"), catalogAlias("รีโน", "SAFE_EXACT", "th"), catalogAlias("เรโน", "SAFE_EXACT", "th"), catalogAlias("รีโน ซีรีส์", "SAFE_EXACT", "th")]],
  ["SMARTPHONE", "A Series", "OPPO A Series", "FAMILY", 55, ["a series", "เอซีรีส์", "รุ่น a", catalogAlias("oppo a", "SAFE_EXACT")]],
  ["SMARTPHONE", "K Series", "OPPO K Series", "FAMILY", 55, ["oppo k series", "k series"]],
  ["SMARTPHONE", "Other Smartphones", "OPPO Smartphone", "GENERIC", 25, ["oppo smartphone", "oppo phone", "โทรศัพท์ oppo", "มือถือ oppo", "สมาร์ตโฟน oppo"]],
  ["TABLET", "OPPO Pad Series", "OPPO Pad 3", "MODEL", 110, [catalogAlias("oppo pad 3", "SAFE_EXACT"), catalogAlias("pad 3", "SAFE_COMPACT"), catalogAlias("pad3", "SAFE_COMPACT"), catalogAlias("แพด3", "SAFE_COMPACT", "th"), catalogAlias("แพด 3", "SAFE_COMPACT", "th"), catalogAlias("แท็บเล็ต pad 3", "SAFE_COMPACT", "th"), catalogAlias("แท็บเล็ตแพด 3", "SAFE_COMPACT", "th"), catalogAlias("แท็บเล็ตแพด3", "SAFE_COMPACT", "th")]],
  ["TABLET", "OPPO Pad Air Series", "OPPO Pad Air Series", "FAMILY", 65, ["oppo pad air", "pad air", "แพดแอร์"]],
  ["TABLET", "OPPO Pad Series", "OPPO Pad Series", "FAMILY", 55, ["oppo pad", "oppo แพด", "แท็บเล็ต oppo"]],
  ["WEARABLE", "OPPO Watch Series", "OPPO Watch X2", "MODEL", 110, [catalogAlias("oppo watch x2", "SAFE_EXACT"), catalogAlias("watch x2", "SAFE_COMPACT"), catalogAlias("watchx2", "SAFE_COMPACT"), catalogAlias("นาฬิกา x2", "SAFE_COMPACT", "th")]],
  ["WEARABLE", "OPPO Watch Series", "OPPO Watch Series", "FAMILY", 55, [catalogAlias("oppo watch", "SAFE_EXACT"), catalogAlias("oppo smartwatch", "SAFE_EXACT"), catalogAlias("smartwatch oppo", "SAFE_EXACT"), catalogAlias("สมาร์ตวอทช์ oppo", "SAFE_EXACT", "th"), catalogAlias("นาฬิกา oppo", "SAFE_EXACT", "th"), catalogAlias("smartwatch", "BLOCKED"), catalogAlias("smart watch", "BLOCKED")]],
  ["WEARABLE", "OPPO Band Series", "OPPO Band Series", "FAMILY", 55, ["oppo band", "สายรัดข้อมือ oppo"]],
  ["AUDIO", "OPPO Enco Series", "OPPO Enco Air4", "MODEL", 110, [catalogAlias("oppo enco air 4", "SAFE_EXACT"), catalogAlias("enco air 4", "SAFE_EXACT"), catalogAlias("enco air4", "SAFE_COMPACT"), catalogAlias("encoair4", "SAFE_COMPACT"), catalogAlias("หูฟัง enco air 4", "SAFE_COMPACT", "th"), catalogAlias("หูฟัง enco air4", "SAFE_COMPACT", "th"), catalogAlias("หูฟัง enco air", "SAFE_COMPACT", "th")]],
  ["AUDIO", "OPPO Enco Series", "OPPO Enco Series", "FAMILY", 60, ["oppo enco", "enco", "หูฟัง enco", "เอ็นโค่"]],
  ["AUDIO", "Earbuds", "OPPO Earbuds", "GENERIC", 35, ["oppo earbuds", "หูฟัง oppo", "เอียร์บัด oppo"]],
  ["TV", "OPPO TV", "OPPO TV", "GENERIC", 40, [catalogAlias("oppo tv", "SAFE_EXACT"), catalogAlias("smart tv", "BLOCKED"), catalogAlias("ทีวี oppo", "SAFE_EXACT", "th"), catalogAlias("ทีวี", "BLOCKED", "th"), catalogAlias("โทรทัศน์ oppo", "SAFE_EXACT", "th")]],
  ["SMART_HOME_AIOT", "Router", "OPPO Router", "GENERIC", 40, [catalogAlias("oppo router", "SAFE_EXACT"), catalogAlias("เราเตอร์ oppo", "SAFE_EXACT", "th"), catalogAlias("เราเตอร์", "BLOCKED", "th"), catalogAlias("oppo wifi", "SAFE_EXACT")]],
  ["SMART_HOME_AIOT", "Smart Camera", "OPPO Smart Camera", "GENERIC", 40, [catalogAlias("oppo camera", "SAFE_EXACT"), catalogAlias("oppo cctv", "SAFE_EXACT"), catalogAlias("กล้อง oppo", "SAFE_EXACT", "th"), catalogAlias("กล้องวงจรปิด", "BLOCKED", "th")]],
  ["SMART_HOME_AIOT", "Smart Home", "OPPO Smart Home", "GENERIC", 35, [catalogAlias("oppo smart home", "SAFE_EXACT"), catalogAlias("smart home oppo", "SAFE_EXACT"), catalogAlias("smart home", "REVIEW_REQUIRED"), catalogAlias("oppo aiot", "SAFE_EXACT"), catalogAlias("บ้านอัจฉริยะ oppo", "SAFE_EXACT", "th")]],
  ["ACCESSORIES", "Cases", "OPPO Case", "GENERIC", 130, ["เคส oppo", "oppo case", "เคส reno", "เคส a6", "เคส find", catalogAlias("generic case", "BLOCKED"), catalogAlias("generic film", "BLOCKED"), catalogAlias("screen protector", "BLOCKED")]],
  ["ACCESSORIES", "Charging", "OPPO Charger", "GENERIC", 130, ["ที่ชาร์จ oppo", "oppo charger", "สายชาร์จ oppo", "oppo adapter", "หัวชาร์จ supervooc", catalogAlias("สาย type c oppo", "SAFE_EXACT", "th"), catalogAlias("สาย type c", "BLOCKED", "th"), catalogAlias("type c cable", "BLOCKED")]],
  ["ACCESSORIES", "Accessories", "OPPO Accessories", "GENERIC", 40, ["อุปกรณ์เสริม oppo", "oppo accessories", catalogAlias("oppo power bank", "SAFE_EXACT"), catalogAlias("power bank oppo", "SAFE_EXACT"), catalogAlias("พาวเวอร์แบงก์ oppo", "SAFE_EXACT", "th", false), catalogAlias("power bank", "BLOCKED"), "ฟิล์ม oppo", "ปากกา oppo", "ปากกา oppo pad", catalogAlias("oppo pad keyboard", "SAFE_EXACT", undefined, false), "keyboard oppo", catalogAlias("คีย์บอร์ดแท็บเล็ต", "BLOCKED", "th")]],
  ["SERVICE_AFTER_SALES", "Service", "OPPO Service", "GENERIC", 20, ["ศูนย์บริการ oppo", "ซ่อม oppo", "oppo warranty", "เคลม oppo"]],
].map(([group, family, model, level, priority, aliases]) => ({ group, family, model, level, priority, aliases })) as CatalogEntry[];

export function catalogAliasValue(alias: CatalogAlias): string {
  return typeof alias === "string" ? alias : alias.alias;
}

export function catalogAliasSafety(alias: CatalogAlias): ProductAliasSafety {
  return typeof alias === "string" ? "SAFE_EXACT" : alias.safety;
}

export function productAliasSafety(modelName: string, aliasValue: string): ProductAliasSafety {
  const entry = PRODUCT_CATALOG.find(({ model }) => model === modelName);
  const identity = productAliasSafetyIdentity(aliasValue);
  const exactAlias = entry?.aliases.find((candidate) => productAliasSafetyIdentity(catalogAliasValue(candidate)) === identity);
  if (exactAlias) return catalogAliasSafety(exactAlias);
  const key = compactProductText(aliasValue);
  const compactCandidates = entry?.aliases.filter((candidate) => compactProductText(catalogAliasValue(candidate)) === key) ?? [];
  const safetyLevels = new Set(compactCandidates.map(catalogAliasSafety));
  return safetyLevels.size === 1 && safetyLevels.has("SAFE_COMPACT") ? "SAFE_COMPACT" : "REVIEW_REQUIRED";
}

export function storedProductAliasSafety(modelName: string, aliasValue: string, source: ProductAliasSource | undefined): ProductAliasSafety {
  return source === ProductAliasSource.CATALOG ? productAliasSafety(modelName, aliasValue) : "REVIEW_REQUIRED";
}

export function automaticCatalogAliases(entry: CatalogEntry): CatalogProductAlias[] {
  return entry.aliases
    .map((alias) => typeof alias === "string" ? catalogAlias(alias, "SAFE_EXACT") : alias)
    .filter(({ safety }) => isAutoMatchSafety(safety));
}

export function synchronizableCatalogAliases(entry: CatalogEntry): CatalogProductAlias[] {
  const unsafeRuntimeKeys = new Set(
    entry.aliases
      .filter((alias) => !isAutoMatchSafety(catalogAliasSafety(alias)))
      .map((alias) => compactProductText(catalogAliasValue(alias))),
  );
  return automaticCatalogAliases(entry).filter(
    ({ alias, synchronize }) =>
      synchronize !== false && !unsafeRuntimeKeys.has(compactProductText(alias)),
  );
}

export function automaticCatalogAliasesForModel(modelName: string): CatalogProductAlias[] {
  const entry = PRODUCT_CATALOG.find(({ model }) => model === modelName);
  return entry ? automaticCatalogAliases(entry) : [];
}

export function validateProductCatalog(entries = PRODUCT_CATALOG): string[] {
  const owners = new Map<string, string>(); const errors: string[] = [];
  for (const entry of entries) for (const alias of [entry.model, ...synchronizableCatalogAliases(entry).map(({ alias }) => alias)]) { const key = compactProductText(alias); const owner = owners.get(key); if (normalizeProductText(alias).length < 3) errors.push(`Alias too short: ${alias}`); else if (owner && owner !== entry.model) errors.push(`Alias collision: ${alias} (${owner}, ${entry.model})`); else owners.set(key, entry.model); }
  return errors;
}
