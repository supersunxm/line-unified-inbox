import { createHash } from "node:crypto";

export function historyTimestampsOrdered(times: readonly number[]): boolean {
  return times.every(Number.isFinite) && (times.every((t, i) => !i || t >= times[i - 1])
    || times.every((t, i) => !i || t <= times[i - 1]));
}

/** Identifiers and opaque tokens must be saved privately, never logged. No customer content. */
export interface HistoryCoverageCursor {
  version: 1;
  sourceKey: string;
  lowerBoundAt: string;
  maxPages: number;
  pages: number;
  backward: string | null;
  usedTokens: string[];
  pageHashes: string[];
  oldestAt: number | null;
  status: "IN_PROGRESS" | "COVERAGE_PROVEN" | "COVERAGE_BLOCKED" | "API_LIMITATION" | "AUTHENTICATION_BLOCKED";
  reason: string | null;
}
export function startHistoryCoverage(sourceKey: string, lowerBound: Date, maxPages = 20): HistoryCoverageCursor {
  if (!sourceKey || !Number.isFinite(lowerBound.getTime()) || !Number.isInteger(maxPages) || maxPages < 1 || maxPages > 200) throw new Error("INVALID_HISTORY_COVERAGE_INPUT");
  return { version: 1, sourceKey, lowerBoundAt: lowerBound.toISOString(), maxPages, pages: 0, backward: null,
    usedTokens: [], pageHashes: [], oldestAt: null, status: "IN_PROGRESS", reason: null };
}
export function historyPageUrl(endpoint: string, backward: string | null): string {
  const url = new URL(endpoint);
  if (url.origin !== "https://chat.line.biz" || !/^\/api\/v3\/bots\/[^/]+\/chats\/[^/]+\/messages$/u.test(url.pathname)
    || url.username || url.password || url.hash || url.search) throw new Error("INVALID_HISTORY_ENDPOINT");
  // URL-shaped cursors are opaque too; never navigate to them.
  if (backward !== null) url.searchParams.set("backward", backward);
  return url.href;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function fail(state: HistoryCoverageCursor, reason: string, status: HistoryCoverageCursor["status"] = "COVERAGE_BLOCKED"): HistoryCoverageCursor {
  return { ...state, status, reason };
}
/** Pure response transition. Caller owns IO, bounded retries, leases and atomic private persistence. */
export function observeHistoryPage(state: HistoryCoverageCursor, input: {
  requestedBackward: string | null; httpStatus: number; body: unknown;
}): HistoryCoverageCursor {
  if (state.status !== "IN_PROGRESS") return state;
  if (input.requestedBackward !== state.backward) return fail(state, "CURSOR_RESPONSE_MISMATCH");
  if (input.httpStatus === 401 || input.httpStatus === 403) return fail(state, "HISTORY_AUTHENTICATION", "AUTHENTICATION_BLOCKED");
  if (input.httpStatus === 429 || input.httpStatus >= 500) return { ...state, reason: `HISTORY_HTTP_${input.httpStatus}` };
  if (input.httpStatus !== 200) return fail(state, `HISTORY_HTTP_${input.httpStatus}`, "API_LIMITATION");
  if (!record(input.body) || !Array.isArray(input.body.list)) return fail(state, "HISTORY_INVALID_SHAPE");
  const backward = input.body.backward;
  if (backward !== undefined && backward !== null && typeof backward !== "string") return fail(state, "HISTORY_INVALID_CURSOR");
  const token = typeof backward === "string" && backward.length > 0 ? backward : null;
  const times: number[] = [], keys: string[] = [];
  for (const item of input.body.list) {
    if (!record(item) || (typeof item.timestamp !== "number" && typeof item.timestamp !== "string")
      || (typeof item.timestamp === "string" && !item.timestamp.trim())) return fail(state, "HISTORY_INVALID_TIMESTAMP");
    const time = Number(item.timestamp);
    if (!Number.isFinite(time) || time <= 0 || !Number.isFinite(new Date(time).getTime())) return fail(state, "HISTORY_INVALID_TIMESTAMP");
    times.push(time);
    const message = record(item.message) ? item.message : {};
    keys.push(JSON.stringify([message.id ?? item.id ?? null, item.type ?? null, time]));
  }
  if (!times.length) return fail(state, "HISTORY_EMPTY_PAGE_LOWER_BOUND_UNPROVEN", "API_LIMITATION");
  if (!historyTimestampsOrdered(times)) return fail(state, "HISTORY_TIMESTAMP_INVERSION");
  const hash = createHash("sha256").update(JSON.stringify(keys)).digest("hex");
  if (state.pageHashes.includes(hash)) return fail(state, "HISTORY_REPEATED_PAGE");
  const oldestAt = Math.min(...times);
  if (state.oldestAt !== null && oldestAt >= state.oldestAt) return fail(state, "HISTORY_NO_OLDER_EVIDENCE");
  const next: HistoryCoverageCursor = { ...state, pages: state.pages + 1, oldestAt, backward: token,
    pageHashes: [...state.pageHashes, hash], usedTokens: input.requestedBackward === null
      ? state.usedTokens : [...state.usedTokens, input.requestedBackward], reason: null };
  if (token !== null && (token === input.requestedBackward || next.usedTokens.includes(token))) return fail(next, "HISTORY_CURSOR_LOOP");
  // Source time coverage only: eligibility/parity must be proven separately before store COMPLETE.
  if (oldestAt <= Date.parse(state.lowerBoundAt)) return { ...next, status: "COVERAGE_PROVEN", backward: null };
  if (token === null) return fail(next, "HISTORY_TERMINAL_LOWER_BOUND_UNPROVEN", "API_LIMITATION");
  if (next.pages >= next.maxPages) return fail(next, "HISTORY_PAGE_BUDGET_EXHAUSTED");
  return next;
}

export function serializeHistoryCursor(state: HistoryCoverageCursor): string {
  const payload = JSON.stringify(state);
  return JSON.stringify({ payload, sha256: createHash("sha256").update(payload).digest("hex") });
}
export function restoreHistoryCursor(serialized: string, sourceKey: string, lowerBound: Date): HistoryCoverageCursor {
  const envelope: unknown = JSON.parse(serialized);
  if (!record(envelope) || typeof envelope.payload !== "string" || typeof envelope.sha256 !== "string"
    || createHash("sha256").update(envelope.payload).digest("hex") !== envelope.sha256) throw new Error("HISTORY_CHECKPOINT_INTEGRITY_FAILED");
  const state: unknown = JSON.parse(envelope.payload);
  const strings = (value: unknown): value is string[] => Array.isArray(value) && value.every((v: unknown) => typeof v === "string");
  if (!record(state) || state.version !== 1 || state.sourceKey !== sourceKey || state.lowerBoundAt !== lowerBound.toISOString()
    || typeof state.maxPages !== "number" || !Number.isInteger(state.maxPages) || state.maxPages < 1 || state.maxPages > 200
    || typeof state.pages !== "number" || !Number.isInteger(state.pages) || state.pages < 0 || state.pages > state.maxPages
    || (state.backward !== null && typeof state.backward !== "string")
    || !strings(state.usedTokens) || state.usedTokens.length > state.pages || new Set(state.usedTokens).size !== state.usedTokens.length
    || !strings(state.pageHashes) || state.pageHashes.length !== state.pages || state.pageHashes.some((h) => !/^[a-f0-9]{64}$/u.test(h))
    || (state.oldestAt !== null && (typeof state.oldestAt !== "number" || !Number.isFinite(state.oldestAt)))
    || typeof state.status !== "string" || !["IN_PROGRESS", "COVERAGE_PROVEN", "COVERAGE_BLOCKED", "API_LIMITATION", "AUTHENTICATION_BLOCKED"].includes(state.status)
    || (state.reason !== null && typeof state.reason !== "string")) throw new Error("HISTORY_CHECKPOINT_SCOPE_OR_SHAPE_INVALID");
  if (new Set(state.pageHashes).size !== state.pageHashes.length
    || (state.pages === 0 && state.oldestAt !== null)
    || (state.pages > 0 && state.oldestAt === null)
    || (state.status === "COVERAGE_PROVEN" && (state.pages === 0 || state.oldestAt === null
      || state.oldestAt > lowerBound.getTime() || state.backward !== null))) throw new Error("HISTORY_CHECKPOINT_EVIDENCE_INVALID");
  return { version: 1, sourceKey, lowerBoundAt: state.lowerBoundAt, maxPages: state.maxPages,
    pages: state.pages, backward: state.backward, usedTokens: state.usedTokens, pageHashes: state.pageHashes,
    oldestAt: state.oldestAt, status: state.status as HistoryCoverageCursor["status"], reason: state.reason };
}
