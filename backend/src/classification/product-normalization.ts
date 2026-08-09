export function normalizeProductText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/(ราคา|เท่าไหร่|เท่าไร|กี่บาท|มีไหม|มีมั้ย|มีของไหม|ผ่อน|โปรโมชั่น|โปรโมชัน)/g, " $1 ")
    .replace(/[\\/_+()[\]{}.,:;!?|–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactProductText(value: string): string {
  return normalizeProductText(value).replace(/\boppo\b/g, "").replace(/\s+/g, "");
}

export function productAliasSafetyIdentity(value: string): string {
  return normalizeProductText(value).replace(/\s+/g, "");
}
