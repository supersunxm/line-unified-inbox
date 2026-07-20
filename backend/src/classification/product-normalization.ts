export function normalizeProductText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/[\\/_+()[\]{}.,:;!?|–—-]+/g, " ").replace(/\s+/g, " ").trim();
}

export function compactProductText(value: string): string {
  return normalizeProductText(value).replace(/\boppo\b/g, "").replace(/\s+/g, "");
}
