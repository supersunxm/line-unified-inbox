import { isAutoMatchSafety, ProductAliasSafety } from "./product-alias";
import { compactProductText, normalizeProductText } from "./product-normalization";

export type MatchableModel = { id: string; name: string; classificationLevel: string; priority: number; aliases: Array<{ alias: string; priority: number; safety: ProductAliasSafety }>; productSeries?: { name: string; productGroup: string } };
export type ProductMessage = { id: string; text: string; sentAt: Date };
export type ProductMatch = { model: MatchableModel; confidence: number; matchedPhrase: string; detectionMethod: string; sourceMessageId: string };

type MatchMethod = "NORMALIZED_PHRASE" | "COMPACT_VARIATION";
type MatchSpan = { method: MatchMethod; endTokenIndex: number };

const protectedModelSuffixes = new Set(["pro", "ultra", "lite", "air", "se", "neo", "max", "plus", "5g"]);
const allowedModelContinuations = new Set(["price", "ราคา", "color", "colour", "stock", "available", "availability", "with", "for", "please", "f"]);
const brandContextRequiredGroups = new Set(["TV", "SMART_HOME_AIOT"]);
const thaiOppoTokens = new Set(["ออปโป้", "ออปโป"]);

function productTokens(value: string): string[] {
  return normalizeProductText(value).split(" ").filter(Boolean).flatMap((token) => {
    if (/^oppo[a-z0-9]/.test(token)) return ["oppo", token.slice(4)];
    return [token];
  });
}

function findTokenSequence(textTokens: string[], candidateTokens: string[]): MatchSpan | undefined {
  if (!candidateTokens.length) return undefined;
  for (let start = 0; start <= textTokens.length - candidateTokens.length; start++) {
    if (candidateTokens.every((token, offset) => textTokens[start + offset] === token)) {
      return { method: "NORMALIZED_PHRASE", endTokenIndex: start + candidateTokens.length - 1 };
    }
  }
  return undefined;
}

function findCompactSequence(textTokens: string[], candidate: string): MatchSpan | undefined {
  const compactCandidate = compactProductText(candidate);
  if (compactCandidate.length < 4) return undefined;
  const candidateTokenCount = productTokens(candidate).length;
  const maximumWindow = Math.max(1, candidateTokenCount + 2);
  for (let start = 0; start < textTokens.length; start++) {
    for (let size = 1; size <= maximumWindow && start + size <= textTokens.length; size++) {
      if (compactProductText(textTokens.slice(start, start + size).join(" ")) === compactCandidate) {
        return { method: "COMPACT_VARIATION", endTokenIndex: start + size - 1 };
      }
    }
  }
  return undefined;
}

function hasOppoContext(textTokens: string[]): boolean {
  return textTokens.some((token) => token === "oppo" || thaiOppoTokens.has(token));
}

function hasUnsupportedSuffix(textTokens: string[], span: MatchSpan, model: MatchableModel): boolean {
  if (model.classificationLevel !== "MODEL") return false;
  const suffix = textTokens[span.endTokenIndex + 1];
  if (!suffix || productTokens(model.name).includes(suffix)) return false;
  if (protectedModelSuffixes.has(suffix)) return true;
  if (/^\d+(?:gb|tb)?$/.test(suffix) || /^\d+gb$/.test(suffix) || allowedModelContinuations.has(suffix)) return false;
  return /^[a-z][a-z0-9]*$/.test(suffix);
}

function phraseMatches(text: string, candidate: string, safety: ProductAliasSafety, model: MatchableModel): MatchMethod | undefined {
  if (!isAutoMatchSafety(safety)) return undefined;
  const textTokens = productTokens(text);
  if (model.classificationLevel === "GENERIC" && brandContextRequiredGroups.has(model.productSeries?.productGroup ?? "") && !hasOppoContext(textTokens)) return undefined;
  const exact = findTokenSequence(textTokens, productTokens(candidate));
  const span = exact ?? (safety === "SAFE_COMPACT" ? findCompactSequence(textTokens, candidate) : undefined);
  if (!span || hasUnsupportedSuffix(textTokens, span, model)) return undefined;
  return span.method;
}

export function matchProduct(messages: ProductMessage[], models: MatchableModel[]): ProductMatch | undefined {
  const candidates: Array<ProductMatch & { score: number; sentAt: number }> = [];
  for (const message of messages) for (const model of models) for (const alias of [{ alias: model.name, priority: 0, safety: "SAFE_EXACT" as const }, ...model.aliases]) {
    const method = phraseMatches(message.text, alias.alias, alias.safety, model); if (!method) continue;
    const levelScore = model.classificationLevel === "MODEL" ? 300 : model.classificationLevel === "FAMILY" ? 200 : 100;
    const requestedAccessory = model.productSeries?.productGroup === "ACCESSORIES" ? 300 : 0;
    candidates.push({ model, confidence: method === "NORMALIZED_PHRASE" ? 0.98 : 0.92, matchedPhrase: alias.alias, detectionMethod: method, sourceMessageId: message.id, score: levelScore + requestedAccessory, sentAt: message.sentAt?.getTime() ?? 0 });
  }
  candidates.sort((a, b) => b.score - a.score || b.sentAt - a.sentAt || b.model.priority - a.model.priority);
  const winner = candidates[0];
  if (!winner) return undefined;
  return { model: winner.model, confidence: winner.confidence, matchedPhrase: winner.matchedPhrase, detectionMethod: winner.detectionMethod, sourceMessageId: winner.sourceMessageId };
}
