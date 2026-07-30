import { ProductGroup } from "@prisma/client";
import { compactProductText, normalizeProductText } from "./product-normalization";

export type CatalogEntry = { group: ProductGroup; family: string; model: string; level: "MODEL" | "FAMILY" | "GENERIC"; priority: number; aliases: string[] };
export const PRODUCT_CATALOG: CatalogEntry[] = [
  ["SMARTPHONE", "Reno Series", "OPPO Reno16 Pro 5G", "MODEL", 120, ["reno 16 pro 5g", "reno16 pro", "reno 16 pro"]],
  ["SMARTPHONE", "Reno Series", "OPPO Reno16", "MODEL", 110, ["reno 16", "reno16", "รีโน 16", "เรโน 16"]],
  ["SMARTPHONE", "A Series", "OPPO A6 Pro 5G", "MODEL", 120, ["oppo a6 pro", "a6 pro", "a 6 pro", "a6pro"]],
  ["SMARTPHONE", "A Series", "OPPO A6 5G", "MODEL", 110, ["a6 5g"]],
  ["SMARTPHONE", "Find Series", "OPPO Find X9", "MODEL", 120, ["find x9", "findx9"]],
  ["SMARTPHONE", "Find Series", "OPPO Find Series", "FAMILY", 60, ["oppo find", "find series", "find x", "find n", "find flip", "find fold", "รุ่นเรือธง"]],
  ["SMARTPHONE", "Reno Series", "OPPO Reno Series", "FAMILY", 60, ["oppo reno", "reno series", "reno", "รีโน", "เรโน"]],
  ["SMARTPHONE", "A Series", "OPPO A Series", "FAMILY", 55, ["a series", "เอซีรีส์", "รุ่น a"]],
  ["SMARTPHONE", "K Series", "OPPO K Series", "FAMILY", 55, ["oppo k series", "k series"]],
  ["SMARTPHONE", "Other Smartphones", "OPPO Smartphone", "GENERIC", 25, ["oppo smartphone", "oppo phone", "โทรศัพท์ oppo", "มือถือ oppo", "สมาร์ตโฟน oppo"]],
  ["TABLET", "OPPO Pad Series", "OPPO Pad 3", "MODEL", 110, ["oppo pad 3", "pad 3"]],
  ["TABLET", "OPPO Pad Air Series", "OPPO Pad Air Series", "FAMILY", 65, ["oppo pad air", "pad air"]],
  ["TABLET", "OPPO Pad Series", "OPPO Pad Series", "FAMILY", 55, ["oppo pad", "oppo แพด", "แท็บเล็ต oppo"]],
  ["WEARABLE", "OPPO Watch Series", "OPPO Watch X2", "MODEL", 110, ["oppo watch x2", "watch x2"]],
  ["WEARABLE", "OPPO Watch Series", "OPPO Watch Series", "FAMILY", 55, ["oppo watch", "smartwatch", "smart watch", "สมาร์ตวอทช์ oppo", "นาฬิกา oppo"]],
  ["WEARABLE", "OPPO Band Series", "OPPO Band Series", "FAMILY", 55, ["oppo band", "สายรัดข้อมือ oppo"]],
  ["AUDIO", "OPPO Enco Series", "OPPO Enco Air4", "MODEL", 110, ["enco air4", "enco air 4"]],
  ["AUDIO", "OPPO Enco Series", "OPPO Enco Series", "FAMILY", 60, ["oppo enco", "enco", "หูฟัง enco", "เอ็นโค่"]],
  ["AUDIO", "Earbuds", "OPPO Earbuds", "GENERIC", 35, ["oppo earbuds", "หูฟัง oppo", "เอียร์บัด oppo"]],
  ["TV", "OPPO TV", "OPPO TV", "GENERIC", 40, ["oppo tv", "smart tv", "ทีวี oppo", "ทีวี", "โทรทัศน์ oppo"]],
  ["SMART_HOME_AIOT", "Router", "OPPO Router", "GENERIC", 40, ["oppo router", "เราเตอร์ oppo", "เราเตอร์", "oppo wifi"]],
  ["SMART_HOME_AIOT", "Smart Camera", "OPPO Smart Camera", "GENERIC", 40, ["oppo camera", "oppo cctv", "กล้อง oppo", "กล้องวงจรปิด"]],
  ["SMART_HOME_AIOT", "Smart Home", "OPPO Smart Home", "GENERIC", 35, ["oppo smart home", "smart home", "oppo aiot", "บ้านอัจฉริยะ oppo"]],
  ["ACCESSORIES", "Cases", "OPPO Case", "GENERIC", 130, ["เคส oppo", "oppo case", "เคส reno", "เคส a6", "เคส reno 16", "ฟิล์ม a6 pro"]],
  ["ACCESSORIES", "Charging", "OPPO Charger", "GENERIC", 130, ["ที่ชาร์จ oppo", "oppo charger", "สายชาร์จ oppo", "oppo adapter", "หัวชาร์จ supervooc", "สาย type c"]],
  ["ACCESSORIES", "Accessories", "OPPO Accessories", "GENERIC", 40, ["อุปกรณ์เสริม oppo", "oppo accessories", "power bank oppo", "power bank", "ฟิล์ม oppo", "ปากกา oppo", "ปากกา oppo pad", "keyboard oppo", "คีย์บอร์ดแท็บเล็ต"]],
  ["SERVICE_AFTER_SALES", "Service", "OPPO Service", "GENERIC", 20, ["ศูนย์บริการ oppo", "ซ่อม oppo", "oppo warranty", "เคลม oppo"]],
].map(([group, family, model, level, priority, aliases]) => ({ group, family, model, level, priority, aliases })) as CatalogEntry[];

export function validateProductCatalog(entries = PRODUCT_CATALOG): string[] {
  const owners = new Map<string, string>(); const errors: string[] = [];
  for (const entry of entries) for (const alias of [entry.model, ...entry.aliases]) { const key = compactProductText(alias); const owner = owners.get(key); if (normalizeProductText(alias).length < 3) errors.push(`Alias too short: ${alias}`); else if (owner && owner !== entry.model) errors.push(`Alias collision: ${alias} (${owner}, ${entry.model})`); else owners.set(key, entry.model); }
  return errors;
}
