import { PrismaClient } from "@prisma/client";
import { normalizeSearchText } from "../store-master/store-master.utils";

export const lineOaIntegrityIssueTypes = [
  "OA_BASIC_ID_MASTER_MISMATCH",
  "OA_ACCOUNT_NAME_MASTER_MISMATCH",
  "STORE_ID_MASTER_MISMATCH",
  "MULTIPLE_ACTIVE_OA_PER_STORE",
  "CONVERSATION_STORE_MISMATCH",
  "ACTIVE_OA_ON_ARCHIVED_STORE",
  "DUPLICATE_ACTIVE_BASIC_ID",
  "DUPLICATE_ACTIVE_CHANNEL_ID",
  "DUPLICATE_ACTIVE_DESTINATION_ID",
] as const;

export type LineOaIntegrityIssueType = (typeof lineOaIntegrityIssueTypes)[number];

export type LineOaIntegrityIssue = {
  type: LineOaIntegrityIssueType;
  oaId?: string;
  oaIds?: string[];
  storeId?: string | null;
  storeIds?: Array<string | null>;
  storeCode?: string | null;
  storeMasterId?: string | null;
  masterExternalStoreId?: string | null;
  basicId?: string | null;
  masterLineId?: string | null;
  accountName?: string;
  masterAccountName?: string | null;
  conversationIds?: string[];
  identifier?: string;
};

export type LineOaIntegrityAuditReport = {
  generatedAt: string;
  dryRun: true;
  activeStoreOaCount: number;
  summary: Record<LineOaIntegrityIssueType, number>;
  migrationSafe: boolean;
  identityConflict: number;
  multipleActiveOaPerStore: number;
  conversationStoreMismatch: number;
  issues: LineOaIntegrityIssue[];
};

type AuditClient = Pick<PrismaClient, "lineOfficialAccount" | "storeMaster">;

function clean(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function equalInsensitive(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = clean(left)?.toLocaleLowerCase("en-US") ?? null;
  const normalizedRight = clean(right)?.toLocaleLowerCase("en-US") ?? null;
  return normalizedLeft === normalizedRight;
}

export async function auditActiveStoreLineOaIntegrity(prisma: AuditClient): Promise<LineOaIntegrityAuditReport> {
  const [accounts, activeMasters] = await Promise.all([prisma.lineOfficialAccount.findMany({
    where: { accountType: "STORE", isActive: true, archivedAt: null },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      basicId: true,
      channelId: true,
      destinationId: true,
      storeId: true,
      store: {
        select: {
          id: true,
          code: true,
          isActive: true,
          archivedAt: true,
          storeMasterId: true,
          storeMaster: {
            select: { id: true, externalStoreId: true, lineId: true, accountName: true },
          },
        },
      },
      conversations: { select: { id: true, storeId: true } },
    },
  }), prisma.storeMaster.findMany({
    where: { isActive: true },
    select: { id: true, externalStoreId: true, lineId: true },
  })]);

  const mastersByLineId = new Map<string, typeof activeMasters>();
  for (const master of activeMasters) {
    const lineId = clean(master.lineId)?.toLocaleLowerCase("en-US");
    if (lineId) mastersByLineId.set(lineId, [...(mastersByLineId.get(lineId) ?? []), master]);
  }
  let identityConflict = 0;

  const issues: LineOaIntegrityIssue[] = [];
  const grouped = <T>(valueFor: (account: (typeof accounts)[number]) => T | null | undefined) => {
    const groups = new Map<T, (typeof accounts)[number][]>();
    for (const account of accounts) {
      const value = valueFor(account);
      if (value === null || value === undefined || value === "") continue;
      groups.set(value, [...(groups.get(value) ?? []), account]);
    }
    return [...groups.entries()].filter(([, matches]) => matches.length > 1);
  };

  for (const account of accounts) {
    const store = account.store;
    const master = store?.storeMaster;
    const common = {
      oaId: account.id,
      storeId: account.storeId,
      storeCode: clean(store?.code),
      storeMasterId: store?.storeMasterId ?? null,
      masterExternalStoreId: clean(master?.externalStoreId),
      basicId: clean(account.basicId),
      masterLineId: clean(master?.lineId),
      accountName: account.name,
      masterAccountName: master?.accountName ?? null,
    };

    if (master?.lineId && !equalInsensitive(account.basicId, master.lineId)) {
      issues.push({ type: "OA_BASIC_ID_MASTER_MISMATCH", ...common });
    }
    const mastersForBasicId = mastersByLineId.get(clean(account.basicId)?.toLocaleLowerCase("en-US") ?? "") ?? [];
    if (master && mastersForBasicId.length === 1 && mastersForBasicId[0].id !== master.id) identityConflict += 1;
    if (master?.accountName && normalizeSearchText(account.name) !== normalizeSearchText(master.accountName)) {
      issues.push({ type: "OA_ACCOUNT_NAME_MASTER_MISMATCH", ...common });
    }
    if (!store || !master || !equalInsensitive(store.code, master.externalStoreId)) {
      issues.push({ type: "STORE_ID_MASTER_MISMATCH", ...common });
    }
    if (store && (!store.isActive || store.archivedAt)) {
      issues.push({ type: "ACTIVE_OA_ON_ARCHIVED_STORE", ...common });
    }
    const mismatchedConversations = account.conversations
      .filter((conversation) => conversation.storeId !== account.storeId)
      .map((conversation) => conversation.id);
    if (mismatchedConversations.length > 0) {
      issues.push({ type: "CONVERSATION_STORE_MISMATCH", ...common, conversationIds: mismatchedConversations });
    }
  }

  for (const [storeId, matches] of grouped((account) => account.storeId)) {
    issues.push({
      type: "MULTIPLE_ACTIVE_OA_PER_STORE",
      storeId,
      oaIds: matches.map((account) => account.id),
      basicId: matches.map((account) => clean(account.basicId)).filter(Boolean).join(", ") || null,
    });
  }

  const addDuplicateIssues = (
    type: "DUPLICATE_ACTIVE_BASIC_ID" | "DUPLICATE_ACTIVE_CHANNEL_ID" | "DUPLICATE_ACTIVE_DESTINATION_ID",
    values: Array<[string, (typeof accounts)[number][]]>,
  ) => {
    for (const [identifier, matches] of values) {
      issues.push({
        type,
        identifier,
        oaIds: matches.map((account) => account.id),
        storeIds: matches.map((account) => account.storeId),
      });
    }
  };
  addDuplicateIssues("DUPLICATE_ACTIVE_BASIC_ID", grouped((account) => clean(account.basicId)?.toLocaleLowerCase("en-US")));
  addDuplicateIssues("DUPLICATE_ACTIVE_CHANNEL_ID", grouped((account) => clean(account.channelId)));
  addDuplicateIssues("DUPLICATE_ACTIVE_DESTINATION_ID", grouped((account) => clean(account.destinationId)));

  const summary = Object.fromEntries(
    lineOaIntegrityIssueTypes.map((type) => [type, issues.filter((issue) => issue.type === type).length]),
  ) as Record<LineOaIntegrityIssueType, number>;
  return {
    generatedAt: new Date().toISOString(),
    dryRun: true,
    activeStoreOaCount: accounts.length,
    summary,
    migrationSafe: summary.MULTIPLE_ACTIVE_OA_PER_STORE === 0,
    identityConflict,
    multipleActiveOaPerStore: summary.MULTIPLE_ACTIVE_OA_PER_STORE,
    conversationStoreMismatch: summary.CONVERSATION_STORE_MISMATCH,
    issues,
  };
}
