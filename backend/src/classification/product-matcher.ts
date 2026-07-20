import { compactProductText, normalizeProductText } from "./product-normalization";

export type MatchableModel = { id: string; name: string; classificationLevel: string; priority: number; aliases: Array<{ alias: string; priority: number }>; productSeries?: { name: string; productGroup: string } };
export type ProductMessage = { id: string; text: string; sentAt: Date };
export type ProductMatch = { model: MatchableModel; confidence: number; matchedPhrase: string; detectionMethod: string; sourceMessageId: string };

function phraseMatches(text: string, candidate: string): "NORMALIZED_PHRASE" | "COMPACT_VARIATION" | undefined {
  const normalizedText = ` ${normalizeProductText(text)} `; const normalizedCandidate = normalizeProductText(candidate);
  if (normalizedCandidate.length >= 3 && normalizedText.includes(` ${normalizedCandidate} `)) return "NORMALIZED_PHRASE";
  const compact = compactProductText(candidate);
  const requiresOppoContext = /\boppo\b/.test(normalizedCandidate);
  if (compact.length >= 4 && (!requiresOppoContext || /\boppo\b/.test(normalizeProductText(text))) && compactProductText(text).includes(compact)) return "COMPACT_VARIATION";
  return undefined;
}

export function matchProduct(messages: ProductMessage[], models: MatchableModel[]): ProductMatch | undefined {
  const candidates: Array<ProductMatch & { score: number; sentAt: number }> = [];
  for (const message of messages) for (const model of models) for (const alias of [{ alias: model.name, priority: 0 }, ...model.aliases]) {
    const method = phraseMatches(message.text, alias.alias); if (!method) continue;
    const levelScore = model.classificationLevel === "MODEL" ? 300 : model.classificationLevel === "FAMILY" ? 200 : 100;
    const requestedAccessory = model.productSeries?.productGroup === "ACCESSORIES" ? 300 : 0;
    candidates.push({ model, confidence: method === "NORMALIZED_PHRASE" ? 0.98 : 0.92, matchedPhrase: alias.alias, detectionMethod: method, sourceMessageId: message.id, score: levelScore + requestedAccessory, sentAt: message.sentAt?.getTime() ?? 0 });
  }
  candidates.sort((a, b) => b.score - a.score || b.sentAt - a.sentAt || b.model.priority - a.model.priority);
  const winner = candidates[0];
  if (!winner) return undefined;
  return { model: winner.model, confidence: winner.confidence, matchedPhrase: winner.matchedPhrase, detectionMethod: winner.detectionMethod, sourceMessageId: winner.sourceMessageId };
}
