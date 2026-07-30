export type ProductAliasSafety = "SAFE_EXACT" | "SAFE_COMPACT" | "REVIEW_REQUIRED" | "BLOCKED";

export type CatalogProductAlias = {
  alias: string;
  safety: ProductAliasSafety;
  language?: string;
  synchronize?: boolean;
};

export function catalogAlias(
  alias: string,
  safety: ProductAliasSafety,
  language?: string,
  synchronize = true,
): CatalogProductAlias {
  return { alias, safety, language, synchronize };
}

export function isAutoMatchSafety(safety: ProductAliasSafety): boolean {
  return safety === "SAFE_EXACT" || safety === "SAFE_COMPACT";
}
