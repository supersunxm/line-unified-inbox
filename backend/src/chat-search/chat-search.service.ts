import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { MessageDirection, Prisma, UserRole } from "@prisma/client";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { PrismaService } from "../prisma.service";
import {
  buildChatMessageSearchSql,
  buildMessageSnippet,
  CHAT_MESSAGE_SEARCH_TIMEZONE,
  chatSearchFingerprint,
  chatSearchKeywordVariants,
  decodeChatSearchCursor,
  encodeChatSearchCursor,
  parseChatMessageSearchInput,
  type ChatMessageSearchInput,
  type ChatMessageSearchCursor,
} from "./chat-search-query";

export const CHAT_MESSAGE_SEARCH_FLAG = "CHAT_MESSAGE_SEARCH_ENABLED";

/** Server-side feature flag. Disabled unless the environment explicitly sets it to "true". */
export function isChatMessageSearchEnabled(): boolean {
  return process.env[CHAT_MESSAGE_SEARCH_FLAG] === "true";
}

export type ChatMessageSearchLimits = {
  /** PostgreSQL statement_timeout applied to the search statement only. */
  statementTimeoutMs: number;
  /** Prisma interactive transaction timeout, which releases the pooled connection. */
  transactionTimeoutMs: number;
  /** Concurrent searches allowed per process, so one caller cannot exhaust the connection pool. */
  maxConcurrent: number;
};

export const DEFAULT_CHAT_MESSAGE_SEARCH_LIMITS: ChatMessageSearchLimits = {
  statementTimeoutMs: 5_000,
  transactionTimeoutMs: 7_000,
  maxConcurrent: 2,
};

export type ChatMessageSearchRow = {
  messageId: string;
  conversationId: string;
  storeId: string;
  storeName: string;
  customerDisplayName: string | null;
  direction: MessageDirection;
  sentAt: Date;
  originalText: string;
};

export type ChatMessageSearchItem = {
  source: "LIVE";
  messageId: string;
  conversationId: string;
  storeId: string;
  storeName: string;
  customerDisplayName: string | null;
  direction: MessageDirection;
  sentAt: string;
  snippet: string;
};

export type ChatMessageSearchResponse = {
  items: ChatMessageSearchItem[];
  hasMore: boolean;
  nextCursor: string | null;
  limit: number;
  scope: {
    timezone: typeof CHAT_MESSAGE_SEARCH_TIMEZONE;
    startDate: string;
    endDate: string;
    stores: { mode: "ALL_AUTHORIZED" } | { mode: "SELECTED"; storeIds: string[] };
  };
};

/** HQ/back-office only: platform admins, or accounts holding the HQ workspace with all-store scope. */
function assertHqSearchUser(user: AuthUser | undefined): AuthUser {
  if (!user) throw new ForbiddenException({ code: "CHAT_SEARCH_HQ_REQUIRED", message: "Global chat search is available to HQ accounts only" });
  const hqWorkspace = user.authorization?.workspaces?.hq === true && user.authorization.scope?.allStores === true;
  if (user.role !== UserRole.ADMIN && !hqWorkspace) {
    throw new ForbiddenException({ code: "CHAT_SEARCH_HQ_REQUIRED", message: "Global chat search is available to HQ accounts only" });
  }
  return user;
}

function isStatementTimeout(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  const message = error instanceof Error ? error.message : "";
  // P2028 is Prisma's generic transaction error; only its timeout variant counts as a search timeout.
  const transactionTimeout = code === "P2028" && /timeout|timed out/iu.test(message);
  return /canceling statement due to statement timeout|57014/iu.test(message)
    || transactionTimeout
    || code === "57014";
}

function isPoolTimeout(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === "P2024";
}

function toSearchError(error: unknown): unknown {
  if (isStatementTimeout(error)) {
    return new ServiceUnavailableException({ code: "CHAT_SEARCH_TIMEOUT", message: "Search took too long. Narrow the date range or keyword." });
  }
  if (isPoolTimeout(error)) {
    return new ServiceUnavailableException({ code: "CHAT_SEARCH_UNAVAILABLE", message: "Search is temporarily unavailable. Try again shortly." });
  }
  return error;
}

@Injectable()
export class ChatSearchService {
  readonly limits: ChatMessageSearchLimits = { ...DEFAULT_CHAT_MESSAGE_SEARCH_LIMITS };
  private activeSearches = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  async search(user: AuthUser | undefined, input: ChatMessageSearchInput): Promise<ChatMessageSearchResponse> {
    if (!isChatMessageSearchEnabled()) throw new NotFoundException();
    const authorized = assertHqSearchUser(user);
    const parsed = parseChatMessageSearchInput(input);
    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(authorized);
    if (parsed.storeIds !== null && accessibleStoreIds !== null) {
      const allowed = new Set(accessibleStoreIds);
      if (parsed.storeIds.some((storeId) => !allowed.has(storeId))) {
        throw new ForbiddenException({ code: "CHAT_SEARCH_STORE_FORBIDDEN", message: "Store access is forbidden" });
      }
    }
    // null means every store the HQ account may see; an explicit selection is already verified above.
    const storeFilter = parsed.storeIds ?? accessibleStoreIds;
    const keywordVariants = chatSearchKeywordVariants(parsed.keyword);
    const fingerprint = chatSearchFingerprint({
      keyword: parsed.keyword,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      storeIds: storeFilter,
    });
    const cursor = parsed.cursor === null ? null : decodeChatSearchCursor(parsed.cursor, fingerprint);
    const scope: ChatMessageSearchResponse["scope"] = {
      timezone: CHAT_MESSAGE_SEARCH_TIMEZONE,
      startDate: parsed.startDate,
      endDate: parsed.endDate,
      stores: parsed.storeIds === null
        ? { mode: "ALL_AUTHORIZED" }
        : { mode: "SELECTED", storeIds: parsed.storeIds },
    };
    if (storeFilter !== null && storeFilter.length === 0) {
      return { items: [], hasMore: false, nextCursor: null, limit: parsed.limit, scope };
    }

    const release = this.acquireSearchSlot();
    let rows: ChatMessageSearchRow[];
    try {
      rows = await this.runSearch({
        keywordVariants,
        range: parsed.range,
        storeIds: storeFilter,
        cursor,
        limit: parsed.limit,
      });
    } finally {
      release();
    }

    const hasMore = rows.length > parsed.limit;
    const page = rows.slice(0, parsed.limit);
    const last = page.at(-1);
    return {
      items: page.map((row) => ({
        source: "LIVE",
        messageId: row.messageId,
        conversationId: row.conversationId,
        storeId: row.storeId,
        storeName: row.storeName,
        customerDisplayName: row.customerDisplayName,
        direction: row.direction,
        sentAt: row.sentAt.toISOString(),
        snippet: buildMessageSnippet(row.originalText, keywordVariants),
      })),
      hasMore,
      nextCursor: hasMore && last
        ? encodeChatSearchCursor({ sentAt: last.sentAt, messageId: last.messageId }, fingerprint)
        : null,
      limit: parsed.limit,
      scope,
    };
  }

  private acquireSearchSlot(): () => void {
    if (this.activeSearches >= this.limits.maxConcurrent) {
      throw new HttpException(
        { code: "CHAT_SEARCH_BUSY", message: "Search is busy. Try again shortly." },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.activeSearches += 1;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.activeSearches -= 1;
    };
  }

  private async runSearch(args: {
    keywordVariants: string[];
    range: { gte: Date; lt: Date };
    storeIds: string[] | null;
    cursor: ChatMessageSearchCursor | null;
    limit: number;
  }): Promise<ChatMessageSearchRow[]> {
    const sql = buildChatMessageSearchSql(args);
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          // Must be the first statement so the transaction cannot write.
          await tx.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
          await tx.$queryRaw(Prisma.sql`SELECT set_config('statement_timeout', ${String(this.limits.statementTimeoutMs)}, true)`);
          return tx.$queryRaw<ChatMessageSearchRow[]>(sql);
        },
        { maxWait: 2_000, timeout: this.limits.transactionTimeoutMs },
      );
    } catch (error) {
      throw toSearchError(error);
    }
  }
}
