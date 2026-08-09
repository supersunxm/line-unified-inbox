import { isAutoMatchSafety, ProductAliasSafety } from "./product-alias";
import { compactProductText, normalizeProductText } from "./product-normalization";

export type SemanticDetectionMethod = "EXACT_ALIAS" | "PHONETIC_ALIAS" | "COMPACT_ALIAS" | "SERIES_MATCH" | "MANUAL_OVERRIDE";

export type MatchableModel = { id: string; name: string; classificationLevel: string; priority: number; aliases: Array<{ alias: string; priority: number; safety: ProductAliasSafety; language?: string }>; productSeries?: { name: string; productGroup: string } };
export type ProductMessage = { id: string; text: string; sentAt: Date };
export type ProductMatch = { model: MatchableModel; confidence: number; matchedPhrase: string; detectionMethod: SemanticDetectionMethod; sourceMessageId: string };

type MatchMethod = "NORMALIZED_PHRASE" | "COMPACT_VARIATION";
type MatchSpan = { method: MatchMethod; endTokenIndex: number };

const protectedModelSuffixes = new Set(["pro", "ultra", "lite", "air", "se", "neo", "max", "plus", "5g", "mini", "zoom", "zoom5g"]);
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
  return protectedModelSuffixes.has(suffix);
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

/**
 * Maps an internal match method + alias metadata → semantic detection method label.
 * Stored in ConversationProduct.detectionMethod.
 *
 * COMPACT_VARIATION (any alias)                      → COMPACT_ALIAS
 * NORMALIZED_PHRASE + FAMILY or GENERIC level        → SERIES_MATCH
 * NORMALIZED_PHRASE + Thai language alias (lang=th)  → PHONETIC_ALIAS
 * NORMALIZED_PHRASE + MODEL level + non-Thai alias   → EXACT_ALIAS
 */
export function toSemanticMethod(
  internalMethod: MatchMethod,
  classificationLevel: string,
  aliasLanguage: string | undefined,
): SemanticDetectionMethod {
  if (internalMethod === "COMPACT_VARIATION") return "COMPACT_ALIAS";
  if (classificationLevel === "FAMILY" || classificationLevel === "GENERIC") return "SERIES_MATCH";
  if (aliasLanguage === "th") return "PHONETIC_ALIAS";
  return "EXACT_ALIAS";
}

export function matchProduct(messages: ProductMessage[], models: MatchableModel[]): ProductMatch | undefined {
  const candidates: Array<ProductMatch & { score: number; sentAt: number }> = [];
  for (const message of messages) {
    if (!message.text?.trim()) continue;
    for (const model of models) {
      for (const alias of [{ alias: model.name, priority: 0, safety: "SAFE_EXACT" as const, language: undefined }, ...model.aliases]) {
        const method = phraseMatches(message.text, alias.alias, alias.safety, model);
        if (!method) continue;
        const levelScore = model.classificationLevel === "MODEL" ? 300 : model.classificationLevel === "FAMILY" ? 200 : 100;
        const accessoryScore = model.productSeries?.productGroup === "ACCESSORIES" ? 150 : 0;
        const semanticMethod = toSemanticMethod(method, model.classificationLevel, alias.language);
        candidates.push({ model, confidence: method === "NORMALIZED_PHRASE" ? 0.98 : 0.92, matchedPhrase: alias.alias, detectionMethod: semanticMethod, sourceMessageId: message.id, score: levelScore + accessoryScore, sentAt: message.sentAt?.getTime() ?? 0 });
      }
    }
  }
  candidates.sort((a, b) => b.score - a.score || b.sentAt - a.sentAt || b.model.priority - a.model.priority);
  const winner = candidates[0];
  if (!winner) return undefined;
  return { model: winner.model, confidence: winner.confidence, matchedPhrase: winner.matchedPhrase, detectionMethod: winner.detectionMethod, sourceMessageId: winner.sourceMessageId };
}

