export type DistributionItem = { label: string; count: number };

const MISSING_DISTRIBUTION_LABELS = new Set([
  "",
  "UNSPECIFIED",
  "UNKNOWN",
  "NOT SPECIFIED",
  "N/A",
  "NA",
]);

export function isMissingDistributionLabel(label: string) {
  return MISSING_DISTRIBUTION_LABELS.has(label.trim().toUpperCase());
}

export function formatDistributionLabel(label: string) {
  return label
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function prepareDistribution(items: DistributionItem[]) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const knownItems = items.filter((item) => !isMissingDistributionLabel(item.label));
  const knownTotal = knownItems.reduce((sum, item) => sum + item.count, 0);
  const missingCount = total - knownTotal;

  return { total, knownItems, knownTotal, missingCount };
}
