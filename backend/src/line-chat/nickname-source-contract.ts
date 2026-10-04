import { createHash } from "node:crypto";

export const NICKNAME_SOURCE_RULE_VERSION = "manager-source-v1";
export const SOURCE_TAGS = ["TikTok", "Facebook", "Instagram", "LINE", "Website", "Lemon8"] as const;
export type SourceTag = typeof SOURCE_TAGS[number];
export const AUDIT_CLASSES = ["TAG_MAPPED", "TAG_NEEDS_UPDATE", "NO_TAG_SIGNAL", "AMBIGUOUS", "IDENTITY_CONFLICT", "UNKNOWN"] as const;
export type AuditClass = typeof AUDIT_CLASSES[number];
export type ParsedSource = { kind: "SIGNAL" | "NO_TAG_SIGNAL" | "AMBIGUOUS" | "UNKNOWN"; tag: SourceTag | null; ruleId: string | null; reason: string };

/** Exact supported whole-nickname syntax only. No platform word/name inference. */
export function parseNicknameSource(nickname: string | null, readable: boolean): ParsedSource {
  if (!readable || (nickname?.length ?? 0) > 1000 || [...(nickname ?? "")].some(c => c.charCodeAt(0) <= 31 || (c.charCodeAt(0) >= 127 && c.charCodeAt(0) <= 159))) {
    return { kind: "UNKNOWN", tag: null, ruleId: null, reason: "NICKNAME_UNREADABLE" };
  }
  const value = (nickname ?? "").replace(/\s+/gu, " ").trim();
  // Frozen v1 grammar. Do not inherit future changes to the legacy sales parser.
  const exact = /^(TikTok|Facebook|Instagram|IG|LINE|Website|Lemon8) (0[1-9]|1[0-2])\/(\d{2})$/iu.exec(value);
  const aliasesToTag: Readonly<Record<string, SourceTag>> = {
    tiktok: "TikTok", facebook: "Facebook", instagram: "Instagram", ig: "Instagram",
    line: "LINE", website: "Website", lemon8: "Lemon8",
  };
  if (exact) {
    const tag = aliasesToTag[exact[1].toLowerCase()];
    return { kind: "SIGNAL", tag, ruleId: `SOURCE_PERIOD_${tag}`, reason: "EXACT_SOURCE_PERIOD" };
  }
  // Repeated complete signals or an explicit list of source aliases sharing a period.
  // Detect only when the ENTIRE nickname has this grammar, never arbitrary words.
  const aliases = "(?:TikTok|Facebook|Instagram|IG|LINE|Website|Lemon8)";
  const period = "(?:0[1-9]|1[0-2])/\\d{2}";
  const joined = new RegExp(`^${aliases}(?:[ ,;+|/]+${aliases})+ ${period}$`, "iu");
  const repeated = new RegExp(`^${aliases} ${period}(?:[ ,;+|]+${aliases} ${period})+$`, "iu");
  if (joined.test(value) || repeated.test(value)) {
    return { kind: "AMBIGUOUS", tag: null, ruleId: "MULTIPLE_SOURCE_SIGNALS", reason: "MULTIPLE_SOURCE_SIGNALS" };
  }
  return { kind: "NO_TAG_SIGNAL", tag: null, ruleId: null, reason: "NO_SUPPORTED_SOURCE_PERIOD" };
}

export type SourceDestination = { id: string; storeId: string | null; lineOfficialAccountId: string; lineChatUserId: string | null; tag: string | null };
export function classifyNickname(input: {
  storeId: string; lineOfficialAccountId: string; lineChatUserId: string;
  nickname: string | null; readable: boolean; destinations: readonly SourceDestination[];
}): { classification: AuditClass; conversationId: string | null; parsed: ParsedSource; previousTag: string | null; reason: string } {
  const parsed = parseNicknameSource(input.nickname, input.readable);
  const exact = input.destinations.filter(x => x.lineOfficialAccountId === input.lineOfficialAccountId && x.lineChatUserId === input.lineChatUserId);
  if (exact.length !== 1 || exact[0].storeId !== input.storeId) {
    return { classification: "IDENTITY_CONFLICT", conversationId: null, parsed, previousTag: null, reason: exact.length === 0 ? "NO_EXACT_DESTINATION" : exact.length > 1 ? "MULTIPLE_EXACT_DESTINATIONS" : "WRONG_STORE" };
  }
  const target = exact[0];
  const classification = parsed.kind === "SIGNAL" ? target.tag === parsed.tag ? "TAG_MAPPED" : "TAG_NEEDS_UPDATE" : parsed.kind;
  return { classification, conversationId: target.id, parsed, previousTag: target.tag, reason: parsed.reason };
}

export function evidenceHash(value: string): string { return createHash("sha256").update(value).digest("hex"); }
