import { BadRequestException, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { resolveChatMonthRange } from "../chat-period";
import { OperationsService } from "../operations/operations.service";
import { PrismaService } from "../prisma.service";
import { isMonth } from "./month-close-rules";
import { NICKNAME_PARSER_V4_RULE_VERSION } from "./nickname-parser-v4";

export type TagTypeCounts = { online: number; source: number; product: number; film: number; payment: number; finance: number; period: number; date: number };

/** Counts only. read = chats whose nickname was read at least once; tags are Parser v4. */
export type TagCoverageCounts = {
  total: number;
  read: number;
  tagged: number;
  withPeriod: number;
  byType: TagTypeCounts;
};

export function emptyCoverage(): TagCoverageCounts {
  return { total: 0, read: 0, tagged: 0, withPeriod: 0, byType: { online: 0, source: 0, product: 0, film: 0, payment: 0, finance: 0, period: 0, date: 0 } };
}

type TagRow = {
  decision: string;
  customerType: string | null;
  source: string | null;
  productModelIds: string[];
  services: string[];
  paymentMethod: string | null;
  financeProvider: string | null;
  periodYear: number | null;
  eventDate: Date | null;
};

export function addTag(counts: TagCoverageCounts, tag: TagRow | undefined) {
  counts.total++;
  if (!tag) return;
  counts.read++;
  if (tag.decision === "TAGGED") counts.tagged++;
  if (tag.periodYear !== null) counts.withPeriod++;
  if (tag.customerType) counts.byType.online++;
  if (tag.source) counts.byType.source++;
  if (tag.productModelIds.length > 0) counts.byType.product++;
  if (tag.services.length > 0) counts.byType.film++;
  if (tag.paymentMethod) counts.byType.payment++;
  if (tag.financeProvider) counts.byType.finance++;
  if (tag.periodYear !== null) counts.byType.period++;
  if (tag.eventDate) counts.byType.date++;
}

const CHUNK = 5000;

/**
 * Tag coverage per store for a month: the same chats as the /chats month summary
 * (active stores, STORE OAs, operational filter, latest message in the Bangkok month), joined to
 * their Parser v4 tags. A chat without a v4 row has never had its nickname read.
 */
@Injectable()
export class TagCoverageService {
  constructor(private readonly prisma: PrismaService, private readonly operations: OperationsService) {}

  async coverage(month: string, accessibleStoreIds: string[] | null) {
    if (!isMonth(month)) throw new BadRequestException("month must be YYYY-MM");
    const storeScope: Prisma.StoreWhereInput = { isActive: true, archivedAt: null, ...(accessibleStoreIds === null ? {} : { id: { in: accessibleStoreIds } }) };
    const [stores, resetFilter] = await Promise.all([
      this.prisma.store.findMany({ where: storeScope, orderBy: { name: "asc" }, select: { id: true, storeMaster: { select: { externalStoreId: true } } } }),
      this.operations.getOperationalConversationFilter(),
    ]);
    const conversations = await this.prisma.conversation.findMany({
      where: { store: storeScope, lineOfficialAccount: { accountType: "STORE" }, ...(resetFilter as Prisma.ConversationWhereInput), latestMessageAt: resolveChatMonthRange(month) ?? undefined },
      select: { id: true, storeId: true },
    });
    const tags = new Map<string, TagRow>();
    for (let index = 0; index < conversations.length; index += CHUNK) {
      const rows = await this.prisma.nicknameTagV4.findMany({
        where: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, conversationId: { in: conversations.slice(index, index + CHUNK).map((row) => row.id) } },
        select: { conversationId: true, decision: true, customerType: true, source: true, productModelIds: true, services: true, paymentMethod: true, financeProvider: true, periodYear: true, eventDate: true },
      });
      for (const row of rows) tags.set(row.conversationId, row);
    }
    const byStore = new Map(stores.map((store) => [store.id, emptyCoverage()]));
    const network = emptyCoverage();
    for (const conversation of conversations) {
      const tag = tags.get(conversation.id);
      addTag(network, tag);
      const counts = conversation.storeId ? byStore.get(conversation.storeId) : undefined;
      if (counts) addTag(counts, tag);
    }
    const lastRun = await this.prisma.nicknameTagRederiveRun.findFirst({
      where: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, finishedAt: { not: null } },
      orderBy: { finishedAt: "desc" },
      select: { mode: true, finishedAt: true },
    });
    const fullDone = await this.prisma.nicknameTagRederiveRun.count({ where: { parserVersion: NICKNAME_PARSER_V4_RULE_VERSION, mode: "FULL", finishedAt: { not: null } } });
    return {
      month,
      parserVersion: NICKNAME_PARSER_V4_RULE_VERSION,
      // Until the first full pass finishes, coverage is partial and v2 says so.
      rederiveComplete: fullDone > 0,
      updatedAt: lastRun?.finishedAt?.toISOString() ?? null,
      network,
      stores: stores.map((store) => ({ storeUuid: store.id, storeId: store.storeMaster?.externalStoreId ?? null, ...byStore.get(store.id)! })),
    };
  }
}
