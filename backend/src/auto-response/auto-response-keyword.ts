/** Deterministic matching and targeting for centrally managed inbound keyword rules. */
export type KeywordMatchMode = "EXACT" | "CONTAINS";
export type KeywordTargetMode = "SELECTED" | "ALL_ELIGIBLE";
export type KeywordConfig = {
  matcherVersion: 1;
  matchMode: KeywordMatchMode;
  keywords: string[];
  priority: number;
  targetMode: KeywordTargetMode;
  targetLineOaIds: string[];
  excludedLineOaIds: string[];
};

export const normalizeKeyword = (text: string): string =>
  text.normalize("NFKC").toLocaleLowerCase("en").replace(/\s+/gu, " ").trim();

const wordChar = (char: string | undefined) => Boolean(char && /[\p{L}\p{N}_]/u.test(char));

export function parseKeywordConfig(value: unknown): KeywordConfig | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.matcherVersion !== 1 || (data.matchMode !== "EXACT" && data.matchMode !== "CONTAINS")) return null;
  if (data.targetMode !== "SELECTED" && data.targetMode !== "ALL_ELIGIBLE") return null;
  if (!Array.isArray(data.keywords) || !data.keywords.length || data.keywords.length > 30) return null;
  if (!data.keywords.every((s) => typeof s === "string" && s.length > 0 && s.length <= 120 && normalizeKeyword(s).length > 0)) return null;
  if (typeof data.priority !== "number" || !Number.isSafeInteger(data.priority) || data.priority < 0 || data.priority > 1000) return null;
  if (!Array.isArray(data.targetLineOaIds) || !Array.isArray(data.excludedLineOaIds)) return null;
  for (const key of ["targetLineOaIds", "excludedLineOaIds"] as const) {
    const arr = data[key] as unknown[];
    if (arr.length > 300 || !arr.every((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x))) return null;
    if (new Set(arr).size !== arr.length) return null;
  }
  if (data.targetMode === "SELECTED" && !(data.targetLineOaIds as string[]).length) return null;
  const keywords = (data.keywords as string[]).map((x) => normalizeKeyword(x));
  if (new Set(keywords).size !== keywords.length) return null;
  return {
    matcherVersion: 1,
    matchMode: data.matchMode,
    keywords,
    priority: data.priority as number,
    targetMode: data.targetMode,
    targetLineOaIds: data.targetLineOaIds as string[],
    excludedLineOaIds: data.excludedLineOaIds as string[],
  };
}

export function targetsLineOa(config: KeywordConfig, lineOaId: string): boolean {
  return config.targetMode === "ALL_ELIGIBLE"
    ? !config.excludedLineOaIds.includes(lineOaId)
    : config.targetLineOaIds.includes(lineOaId);
}

/** Literal (not regex) contains, with only alphanumeric word boundaries. */
export function matchKeyword(text: string, config: KeywordConfig): { matched: boolean; specificity: number } {
  const incoming = normalizeKeyword(text);
  if (!incoming) return { matched: false, specificity: 0 };
  for (const keyword of config.keywords) {
    if (config.matchMode === "EXACT") {
      if (incoming === keyword) return { matched: true, specificity: 2 };
      continue;
    }
    let at = incoming.indexOf(keyword);
    while (at >= 0) {
      const before = incoming[at - 1];
      const after = incoming[at + keyword.length];
      const left = at === 0 || !wordChar(before) || !wordChar(keyword[0]);
      const right = at + keyword.length === incoming.length || !wordChar(after) || !wordChar(keyword[keyword.length - 1]);
      if (left && right) return { matched: true, specificity: 1 };
      at = incoming.indexOf(keyword, at + 1);
    }
  }
  return { matched: false, specificity: 0 };
}

export function chooseKeywordRule<T extends { id: string; triggerConfig: unknown }>(
  text: string,
  eligibleRules: T[],
): { rule: T | null; ambiguous: boolean } {
  const matches = eligibleRules.flatMap((rule) => {
    const config = parseKeywordConfig(rule.triggerConfig);
    if (!config) return [];
    const result = matchKeyword(text, config);
    return result.matched ? [{ rule, specificity: result.specificity, priority: config.priority }] : [];
  });
  matches.sort((a, b) => b.specificity - a.specificity || b.priority - a.priority);
  if (!matches.length) return { rule: null, ambiguous: false };
  const top = matches[0];
  if (matches.length > 1 && matches[1].specificity === top.specificity && matches[1].priority === top.priority) {
    return { rule: null, ambiguous: true };
  }
  return { rule: top.rule, ambiguous: false };
}
