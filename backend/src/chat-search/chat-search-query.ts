import { createHash } from "node:crypto";
import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolveChatDateRange, type ChatMonthRange } from "../chat-period";

export const CHAT_MESSAGE_SEARCH_TIMEZONE = "Asia/Bangkok";
export const CHAT_MESSAGE_SEARCH_MIN_KEYWORD_LENGTH = 2;
export const CHAT_MESSAGE_SEARCH_MAX_KEYWORD_LENGTH = 100;
export const CHAT_MESSAGE_SEARCH_MAX_DAYS = 90;
export const CHAT_MESSAGE_SEARCH_DEFAULT_LIMIT = 20;
export const CHAT_MESSAGE_SEARCH_MAX_LIMIT = 50;
export const CHAT_MESSAGE_SEARCH_MAX_STORE_IDS = 50;

const DAY_MS = 86_400_000;
const SNIPPET_MAX_LENGTH = 160;
const SNIPPET_LEAD_LENGTH = 60;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;
const STORE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const CURSOR_MESSAGE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const THAI_SARA_AM_COMPOSED = "ำ";
const THAI_SARA_AM_DECOMPOSED = "ํา";

/** Raw query values as they arrive from the request; every field is validated before use. */
export type ChatMessageSearchInput = {
  q?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  storeIds?: unknown;
  cursor?: unknown;
  limit?: unknown;
};

export type ParsedChatMessageSearch = {
  keyword: string;
  startDate: string;
  endDate: string;
  range: ChatMonthRange;
  /** Explicitly selected stores, or null when the caller did not select any. */
  storeIds: string[] | null;
  cursor: string | null;
  limit: number;
};

export type ChatMessageSearchCursor = { sentAt: Date; messageId: string };

function badRequest(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}

/**
 * Canonical form of user keyword input. NFC keeps Thai text semantics; NFKC is
 * deliberately not used because it splits Thai SARA AM (U+0E33) into U+0E4D U+0E32.
 */
export function normalizeChatSearchKeyword(raw: string): string {
  return raw
    .normalize("NFC")
    .split(THAI_SARA_AM_DECOMPOSED).join(THAI_SARA_AM_COMPOSED)
    .replace(/[\u200B-\u200D\uFEFF]/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

/**
 * Stored LINE text may use either the composed or decomposed SARA AM, and PostgreSQL
 * compares code points without normalizing. Both spellings are matched against the same row.
 */
export function chatSearchKeywordVariants(keyword: string): string[] {
  const decomposed = keyword.split(THAI_SARA_AM_COMPOSED).join(THAI_SARA_AM_DECOMPOSED);
  return decomposed === keyword ? [keyword] : [keyword, decomposed];
}

/** Escapes LIKE metacharacters so user input is always a literal substring. */
export function escapeLikeLiteral(value: string): string {
  return value.replace(/[!%_]/gu, (match) => `!${match}`);
}

export function chatSearchContainsPattern(keyword: string): string {
  return `%${escapeLikeLiteral(keyword)}%`;
}

function calendarDateToUtcMs(value: string): number | null {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(utc).toISOString().slice(0, 10) === value ? utc : null;
}

/**
 * Inclusive Asia/Bangkok calendar dates, converted to a half-open UTC window
 * [startDate 00:00+07, endDate+1 00:00+07). Ranges are capped at 90 calendar days.
 */
export function resolveChatSearchRange(startDate: string, endDate: string): ChatMonthRange {
  const startUtc = calendarDateToUtcMs(startDate);
  const endUtc = calendarDateToUtcMs(endDate);
  if (startUtc === null || endUtc === null) {
    throw badRequest("CHAT_SEARCH_INVALID_DATE", "startDate and endDate must be real calendar dates in YYYY-MM-DD form");
  }
  const days = Math.round((endUtc - startUtc) / DAY_MS) + 1;
  if (days < 1) throw badRequest("CHAT_SEARCH_INVALID_DATE", "startDate must not be after endDate");
  if (days > CHAT_MESSAGE_SEARCH_MAX_DAYS) {
    throw badRequest("CHAT_SEARCH_RANGE_TOO_LARGE", `The date range must not exceed ${CHAT_MESSAGE_SEARCH_MAX_DAYS} days`);
  }
  const range = resolveChatDateRange(startDate, endDate);
  if (!range) throw badRequest("CHAT_SEARCH_INVALID_DATE", "startDate and endDate must be valid Asia/Bangkok dates");
  return range;
}

function parseDateField(value: unknown, field: string): string {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) {
    throw badRequest("CHAT_SEARCH_INVALID_DATE", `${field} must use YYYY-MM-DD (Asia/Bangkok)`);
  }
  return value;
}

function parseKeyword(value: unknown): string {
  if (typeof value !== "string") throw badRequest("CHAT_SEARCH_INVALID_KEYWORD", "q is required");
  const keyword = normalizeChatSearchKeyword(value);
  const length = [...keyword].length;
  if (length < CHAT_MESSAGE_SEARCH_MIN_KEYWORD_LENGTH || length > CHAT_MESSAGE_SEARCH_MAX_KEYWORD_LENGTH) {
    throw badRequest(
      "CHAT_SEARCH_INVALID_KEYWORD",
      `q must be ${CHAT_MESSAGE_SEARCH_MIN_KEYWORD_LENGTH} to ${CHAT_MESSAGE_SEARCH_MAX_KEYWORD_LENGTH} characters after trimming`,
    );
  }
  return keyword;
}

function parseStoreIds(value: unknown): string[] | null {
  if (value === undefined || value === null) return null;
  const items: unknown[] = Array.isArray(value) ? value : [value];
  const ids = [...new Set(items)];
  if (ids.length === 0) return null;
  if (ids.length > CHAT_MESSAGE_SEARCH_MAX_STORE_IDS) {
    throw badRequest("CHAT_SEARCH_INVALID_STORE", `storeIds accepts at most ${CHAT_MESSAGE_SEARCH_MAX_STORE_IDS} stores`);
  }
  for (const id of ids) {
    if (typeof id !== "string" || !STORE_ID_PATTERN.test(id)) {
      throw badRequest("CHAT_SEARCH_INVALID_STORE", "storeIds contains an invalid store identifier");
    }
  }
  return ids as string[];
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null || value === "") return CHAT_MESSAGE_SEARCH_DEFAULT_LIMIT;
  const limit = typeof value === "number" ? value : typeof value === "string" && /^\d+$/u.test(value) ? Number(value) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > CHAT_MESSAGE_SEARCH_MAX_LIMIT) {
    throw badRequest("CHAT_SEARCH_INVALID_LIMIT", `limit must be an integer from 1 to ${CHAT_MESSAGE_SEARCH_MAX_LIMIT}`);
  }
  return limit;
}

export function parseChatMessageSearchInput(input: ChatMessageSearchInput): ParsedChatMessageSearch {
  const keyword = parseKeyword(input.q);
  const startDate = parseDateField(input.startDate, "startDate");
  const endDate = parseDateField(input.endDate, "endDate");
  const range = resolveChatSearchRange(startDate, endDate);
  let cursor: string | null = null;
  if (input.cursor !== undefined && input.cursor !== null && input.cursor !== "") {
    if (typeof input.cursor !== "string" || input.cursor.length > 512) {
      throw badRequest("CHAT_SEARCH_INVALID_CURSOR", "cursor is invalid");
    }
    cursor = input.cursor;
  }
  return {
    keyword,
    startDate,
    endDate,
    range,
    storeIds: parseStoreIds(input.storeIds),
    cursor,
    limit: parseLimit(input.limit),
  };
}

/** Binds a cursor to the exact query it was issued for, so pages cannot be mixed across searches. */
export function chatSearchFingerprint(input: {
  keyword: string;
  startDate: string;
  endDate: string;
  storeIds: string[] | null;
}): string {
  const stores = input.storeIds === null ? "ALL_AUTHORIZED" : [...input.storeIds].sort().join(",");
  return createHash("sha256")
    .update(JSON.stringify([input.keyword, input.startDate, input.endDate, stores]))
    .digest("hex")
    .slice(0, 32);
}

function invalidCursor(): BadRequestException {
  return badRequest("CHAT_SEARCH_INVALID_CURSOR", "cursor is invalid or does not match this search");
}

export function encodeChatSearchCursor(cursor: ChatMessageSearchCursor, fingerprint: string): string {
  return Buffer.from(
    JSON.stringify({ v: 1, t: cursor.sentAt.toISOString(), i: cursor.messageId, f: fingerprint }),
    "utf8",
  ).toString("base64url");
}

export function decodeChatSearchCursor(token: string, fingerprint: string): ChatMessageSearchCursor {
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(token, "base64url").toString("utf8"));
  } catch {
    throw invalidCursor();
  }
  if (typeof value !== "object" || value === null) throw invalidCursor();
  const record = value as Record<string, unknown>;
  if (record.v !== 1 || record.f !== fingerprint || typeof record.t !== "string" || typeof record.i !== "string") {
    throw invalidCursor();
  }
  const sentAt = new Date(record.t);
  if (Number.isNaN(sentAt.getTime()) || sentAt.toISOString() !== record.t) throw invalidCursor();
  if (!CURSOR_MESSAGE_ID_PATTERN.test(record.i)) throw invalidCursor();
  return { sentAt, messageId: record.i };
}

/** Excerpt around the first case-insensitive match. Text is returned as stored; only the window is cut. */
export function buildMessageSnippet(text: string, keywordVariants: string[]): string {
  if (text.length <= SNIPPET_MAX_LENGTH) return text;
  const haystack = text.toLocaleLowerCase("en-US");
  let matchAt = -1;
  if (haystack.length === text.length) {
    for (const variant of keywordVariants) {
      matchAt = haystack.indexOf(variant.toLocaleLowerCase("en-US"));
      if (matchAt >= 0) break;
    }
  }
  const start = matchAt < 0 ? 0 : Math.max(0, matchAt - SNIPPET_LEAD_LENGTH);
  const end = Math.min(text.length, start + SNIPPET_MAX_LENGTH);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

export function buildChatMessageSearchSql(input: {
  keywordVariants: string[];
  range: ChatMonthRange;
  storeIds: string[] | null;
  cursor: ChatMessageSearchCursor | null;
  limit: number;
}): Prisma.Sql {
  const textMatch = Prisma.join(
    input.keywordVariants.map((variant) => Prisma.sql`m."originalText" ILIKE ${chatSearchContainsPattern(variant)} ESCAPE '!'`),
    " OR ",
  );
  const conditions: Prisma.Sql[] = [
    Prisma.sql`m."sentAt" >= ${input.range.gte}`,
    Prisma.sql`m."sentAt" < ${input.range.lt}`,
    Prisma.sql`(${textMatch})`,
    Prisma.sql`s."isActive" = true`,
    Prisma.sql`s."archivedAt" IS NULL`,
    Prisma.sql`oa."accountType" = 'STORE'`,
    Prisma.sql`oa."isActive" = true`,
    Prisma.sql`oa."archivedAt" IS NULL`,
    Prisma.sql`oa."storeId" = c."storeId"`,
  ];
  if (input.storeIds !== null) {
    conditions.push(Prisma.sql`c."storeId" IN (${Prisma.join(input.storeIds)})`);
  }
  if (input.cursor !== null) {
    conditions.push(Prisma.sql`(m."sentAt", m."id") < (${input.cursor.sentAt}, ${input.cursor.messageId})`);
  }
  return Prisma.sql`
    SELECT m."id" AS "messageId", c."id" AS "conversationId", c."storeId" AS "storeId",
      s."name" AS "storeName", cu."displayName" AS "customerDisplayName",
      m."direction", m."sentAt", m."originalText"
    FROM "Message" m
    JOIN "Conversation" c ON c."id" = m."conversationId"
    JOIN "Store" s ON s."id" = c."storeId"
    JOIN "LineOfficialAccount" oa ON oa."id" = c."lineOfficialAccountId"
    JOIN "Customer" cu ON cu."id" = c."customerId"
    WHERE ${Prisma.join(conditions, " AND ")}
    ORDER BY m."sentAt" DESC, m."id" DESC
    LIMIT ${input.limit + 1}
  `;
}
