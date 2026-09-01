import assert from "node:assert/strict";
import test from "node:test";
import {
  CustomerSalesStatus,
  LineChatSessionStatus,
} from "@prisma/client";
import {
  applyPilotMappings,
  assertPilotMappingStore,
  buildPilotMappingPlan,
  formatPilotMappingReport,
  loadPilotMappingContext,
  type MappingConversationInput,
  type PilotMappingContext,
} from "./line-chat-chat-mapping";
import { parseLineChatListResponse } from "./line-chat-chat-discovery";
import { parseMappingDiscoveryArgs, runMappingDiscoveryCli } from "../../scripts/discover-line-chat-mappings";

const baseDate = new Date("2026-08-31T05:00:00.000Z");
const CHAT_USER_ID_A = `U${"1a".repeat(16)}`;
const CHAT_USER_ID_B = `U${"2b".repeat(16)}`;

function conversation(overrides: Partial<MappingConversationInput> = {}): MappingConversationInput {
  return {
    id: "conversation-1",
    displayName: "Somchai",
    salesStatus: CustomerSalesStatus.ONLINE,
    lineChatUserId: null,
    latestMessageAt: baseDate,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: baseDate,
    lastMessage: { direction: "INBOUND", originalText: "Hello", sentAt: baseDate },
    ...overrides,
  };
}

function context(conversations: readonly MappingConversationInput[] = [conversation()]): PilotMappingContext {
  return {
    store: { id: "store-28375", code: "28375", name: "OBS Robinson Chonburi By OPPO" },
    lineOfficialAccount: {
      id: "oa-28375",
      name: "OPPO BS RBS Chonburi",
      chatBotId: "U729972869a565723cb7fcf7ea28bbc43",
      sessionKey: "profile-b",
      profilePath: "./local-data/profile-b",
      sessionStatus: LineChatSessionStatus.ACTIVE,
    },
    conversations,
  };
}

function candidate(overrides: Partial<{
  chatUserId: string;
  displayName: string | null;
  lastMessageText: string | null;
  lastMessageAt: string | null;
  lastMessageDirection: string | null;
}> = {}) {
  return {
    chatUserId: CHAT_USER_ID_A,
    displayName: "Somchai",
    lastMessageText: "Hello",
    lastMessageAt: baseDate.toISOString(),
    lastMessageDirection: "INBOUND",
    ...overrides,
  };
}

function discovery(chats: ReturnType<typeof candidate>[]) {
  return {
    endpoint: "https://chat.line.biz/api/v1/bots/U729972869a565723cb7fcf7ea28bbc43/chats",
    responseShape: "chats" as const,
    enumerationStatus: "UNVERIFIED" as const,
    chats,
  };
}

test("display name alone never produces EXACT_CONFIDENT", () => {
  const plan = buildPilotMappingPlan(context(), discovery([candidate({ lastMessageText: null, lastMessageAt: null, lastMessageDirection: null })]));
  assert.equal(plan.rows[0].confidence, "POSSIBLE");
});

test("strong unique multi-signal match is EXACT_CONFIDENT", () => {
  const plan = buildPilotMappingPlan(context(), discovery([candidate()]));
  assert.equal(plan.rows[0].confidence, "EXACT_CONFIDENT");
  assert.deepEqual(plan.rows[0].signals, [
    "display_name_exact",
    "last_message_text_exact",
    "last_message_timestamp_within_2m",
    "last_message_direction_exact",
  ]);
});

test("timestamp matching honors Bangkok offsets and the deterministic two-minute tolerance", () => {
  const withinTolerance = buildPilotMappingPlan(context([conversation({
    lastMessage: { direction: "INBOUND", originalText: "Hello", sentAt: new Date("2026-08-31T12:00:00+07:00") },
    latestMessageAt: new Date("2026-08-31T12:00:00+07:00"),
  })]), discovery([candidate({
    lastMessageAt: "2026-08-31T05:02:00.000Z",
  })]));
  assert.equal(withinTolerance.rows[0].confidence, "EXACT_CONFIDENT");
  assert.equal(withinTolerance.rows[0].signals.includes("last_message_timestamp_within_2m"), true);

  const outsideTolerance = buildPilotMappingPlan(context(), discovery([candidate({
    lastMessageAt: "2026-08-31T05:02:01.000Z",
    lastMessageText: null,
    lastMessageDirection: null,
  })]));
  assert.equal(outsideTolerance.rows[0].confidence, "POSSIBLE");
  assert.equal(outsideTolerance.rows[0].signals.includes("last_message_timestamp_within_2m"), false);
});

test("duplicate display names are ambiguous", () => {
  const plan = buildPilotMappingPlan(context(), discovery([
    candidate({ chatUserId: CHAT_USER_ID_A, lastMessageText: null, lastMessageAt: null, lastMessageDirection: null }),
    candidate({ chatUserId: CHAT_USER_ID_B, lastMessageText: null, lastMessageAt: null, lastMessageDirection: null }),
  ]));
  assert.equal(plan.rows[0].confidence, "AMBIGUOUS");
});

test("two database conversations competing for one chat ID are both rejected", () => {
  const plan = buildPilotMappingPlan(context([
    conversation({ id: "conversation-a" }),
    conversation({ id: "conversation-b" }),
  ]), discovery([candidate()]));
  assert.deepEqual(plan.rows.map((row) => row.confidence), ["AMBIGUOUS", "AMBIGUOUS"]);
  assert.equal(plan.summary.conflictsDetected, 1);
});

test("exact and possible rows competing for one chat ID are both rejected", () => {
  const plan = buildPilotMappingPlan(context([
    conversation({ id: "conversation-exact" }),
    conversation({
      id: "conversation-possible",
      lastMessage: { direction: "", originalText: "Different", sentAt: new Date("2026-08-01T00:00:00.000Z") },
      latestMessageAt: new Date("2026-08-01T00:00:00.000Z"),
    }),
  ]), discovery([candidate()]));
  assert.deepEqual(plan.rows.map((row) => row.confidence), ["AMBIGUOUS", "AMBIGUOUS"]);
  assert.equal(plan.summary.conflictsDetected, 1);
});

test("one conversation with two equal candidates is ambiguous", () => {
  const plan = buildPilotMappingPlan(context(), discovery([
    candidate({ chatUserId: CHAT_USER_ID_A }),
    candidate({ chatUserId: CHAT_USER_ID_B }),
  ]));
  assert.equal(plan.rows[0].confidence, "AMBIGUOUS");
});

test("no candidate is NO_MATCH", () => {
  const plan = buildPilotMappingPlan(context(), discovery([
    candidate({ displayName: "Other", lastMessageText: "Different", lastMessageAt: null, lastMessageDirection: null }),
  ]));
  assert.equal(plan.rows[0].confidence, "NO_MATCH");
});

test("existing lineChatUserId is preserved and skipped", () => {
  const existing = "Ud8d5af30ddca3ed4237e157d5d73c2f1";
  const plan = buildPilotMappingPlan(context([conversation({ lineChatUserId: existing })]), discovery([candidate()]));
  assert.equal(plan.rows[0].confidence, "ALREADY_MAPPED");
  assert.equal(plan.rows[0].candidateChatUserId, existing);
  assert.equal(plan.summary.exactConfident, 0);
});

test("a discovered candidate reused by an existing mapping is counted as a conflict", () => {
  const existing = CHAT_USER_ID_A;
  const plan = buildPilotMappingPlan(context([
    conversation({ id: "already-mapped", lineChatUserId: existing }),
    conversation({ id: "unmapped" }),
  ]), discovery([candidate({ chatUserId: existing })]));
  assert.equal(plan.rows[1].confidence, "AMBIGUOUS");
  assert.equal(plan.summary.conflictsDetected, 1);
});

test("only official LINE USER IDs are accepted by the response adapter", () => {
  const result = parseLineChatListResponse({ chats: [
    { userId: `U${"g".repeat(32)}`, displayName: "Non-hex" },
    { userId: `C${"a".repeat(32)}`, displayName: "Group" },
    { userId: `R${"a".repeat(32)}`, displayName: "Room" },
    { userId: CHAT_USER_ID_A, displayName: "OA Manager user" },
  ] }, { botId: "Ubot", endpoint: "https://chat.line.biz/api/v1/bots/Ubot/chats" });
  assert.deepEqual(result.chats.map((chat) => chat.chatUserId), [CHAT_USER_ID_A]);
});

test("context query never selects Customer.lineUserId", async () => {
  let conversationQuery: unknown;
  const prisma = {
    store: { findMany: async () => [{
      id: "store-28375", code: "28375", name: "Pilot", storeMaster: null,
      lineOfficialAccounts: [{
        id: "oa-28375", name: "OPPO BS RBS Chonburi", chatBotId: "U729972869a565723cb7fcf7ea28bbc43", lineChatSessionId: "session-1",
        lineChatSession: { sessionKey: "profile-b", profilePath: "./profile-b", profileStorageKey: null, status: LineChatSessionStatus.ACTIVE },
      }],
    }] },
    conversation: { findMany: async (args: unknown) => {
      conversationQuery = args;
      return [];
    } },
  };
  await loadPilotMappingContext(prisma as never, "28375");
  const json = JSON.stringify(conversationQuery);
  assert.equal(json.includes("lineUserId"), false);
  assert.equal(json.includes("lineChatUserId"), true);
});

test("context rejects an unexpected pilot OA or session identity", async () => {
  const prisma = {
    store: { findMany: async () => [{
      id: "store-28375", code: "28375", name: "Pilot", storeMaster: null,
      lineOfficialAccounts: [{
        id: "oa-28375", name: "Wrong OA", chatBotId: "Uwrong", lineChatSessionId: "session-1",
        lineChatSession: { sessionKey: "wrong-session", profilePath: "./profile", profileStorageKey: null, status: LineChatSessionStatus.ACTIVE },
      }],
    }] },
  };
  await assert.rejects(() => loadPilotMappingContext(prisma as never, "28375"), /unexpected LINE OA or bot/);
});

test("dry-run performs no writes, nickname queue calls, or secret output", async () => {
  let updateCalls = 0;
  const output: string[] = [];
  const prisma = {
    store: { findMany: async () => [{
      id: "store-28375", code: "28375", name: "Pilot", storeMaster: null,
      lineOfficialAccounts: [{
        id: "oa-28375", name: "OPPO BS RBS Chonburi", chatBotId: "U729972869a565723cb7fcf7ea28bbc43", lineChatSessionId: "session-1",
        lineChatSession: { sessionKey: "profile-b", profilePath: "./profile-b", profileStorageKey: null, status: LineChatSessionStatus.ACTIVE },
      }],
    }] },
    conversation: {
      findMany: async () => [{
        id: "conversation-1", lineOfficialAccountId: "oa-28375", customerSalesStatus: CustomerSalesStatus.ONLINE,
        lineChatUserId: null, latestMessageAt: baseDate, createdAt: baseDate, updatedAt: baseDate,
        customer: { displayName: "Somchai" }, messages: [{ direction: "INBOUND", originalText: "Hello", sentAt: baseDate }],
      }],
      updateMany: async () => { updateCalls++; return { count: 1 }; },
    },
  };
  const session = {
    resolveProfilePath: () => "./profile-b",
    discoverChats: async () => ({ ...discovery([candidate()]), botId: "Ubot" }),
  };
  const plan = await runMappingDiscoveryCli(["--store", "28375"], {
    prisma: prisma as never,
    session,
    output: (message) => output.push(message),
  });
  assert.equal(plan.summary.exactConfident, 1);
  assert.equal(plan.enumerationStatus, "UNVERIFIED");
  assert.equal(updateCalls, 0);
  const report = output.join("\n");
  assert.match(report, /DRY-RUN/);
  assert.doesNotMatch(report, /cookie|xsrf|storage state|token/i);
});

test("dry-run reports incomplete enumeration without making it writable", () => {
  const plan = buildPilotMappingPlan(context(), { ...discovery([candidate()]), enumerationStatus: "PARTIAL" });
  const report = formatPilotMappingReport(plan, false);
  assert.match(report, /Chat enumeration status : PARTIAL/);
  assert.match(report, /DRY-RUN \(default; read-only\)/);
});

test("apply writes only exact mappings and never invokes a nickname queue", async () => {
  const updates: unknown[] = [];
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma),
    conversation: {
      updateMany: async (args: unknown) => { updates.push(args); return { count: 1 }; },
    },
  };
  const plan = buildPilotMappingPlan(context([
    conversation({ id: "exact" }),
    conversation({ id: "possible", salesStatus: null, lastMessage: null }),
  ]), discovery([candidate()]));
  const applied = await applyPilotMappings(plan, prisma as never);
  assert.equal(applied.eligibleConfident, 1);
  assert.equal(applied.applyBlocked, true);
  assert.equal(applied.mapped, 0);
  assert.equal(applied.blockReason?.includes("UNVERIFIED"), true);
  assert.equal(updates.length, 0);
});

test("apply permits only explicitly complete enumeration and writes only exact mappings", async () => {
  const updates: unknown[] = [];
  const prisma = {
    $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma),
    conversation: { updateMany: async (args: unknown) => { updates.push(args); return { count: 1 }; } },
  };
  const plan = buildPilotMappingPlan(context(), { ...discovery([candidate()]), enumerationStatus: "COMPLETE" });
  const applied = await applyPilotMappings(plan, prisma as never);
  assert.equal(applied.applyBlocked, false);
  assert.equal(applied.mapped, 1);
  assert.equal(updates.length, 1);
  assert.match(JSON.stringify(updates[0]), /lineChatUserId/);
  assert.doesNotMatch(JSON.stringify(updates[0]), /lineUserId|nickname/i);
});

test("apply is blocked when candidate conflicts remain even if enumeration is complete", async () => {
  let updateCalls = 0;
  const prisma = {
    $transaction: async () => { updateCalls++; },
    conversation: { updateMany: async () => ({ count: 1 }) },
  };
  const plan = buildPilotMappingPlan(context([
    conversation({ id: "a" }),
    conversation({ id: "b" }),
  ]), { ...discovery([candidate()]), enumerationStatus: "COMPLETE" });
  const applied = await applyPilotMappings(plan, prisma as never);
  assert.equal(applied.applyBlocked, true);
  assert.match(applied.blockReason ?? "", /conflict/);
  assert.equal(updateCalls, 0);
});

test("apply is blocked when the pilot identity or parser endpoint precondition changes", async () => {
  let updateCalls = 0;
  const prisma = {
    $transaction: async () => { updateCalls++; },
    conversation: { updateMany: async () => ({ count: 1 }) },
  };
  const plan = buildPilotMappingPlan(context(), { ...discovery([candidate()]), enumerationStatus: "COMPLETE" });
  const altered = { ...plan, store: { ...plan.store, code: "99999" } };
  const applied = await applyPilotMappings(altered, prisma as never);
  assert.equal(applied.applyBlocked, true);
  assert.match(applied.blockReason ?? "", /Only store 28375 is allowed/);
  assert.equal(updateCalls, 0);
});

test("pilot guard rejects every store except 28375", () => {
  assert.doesNotThrow(() => assertPilotMappingStore("28375"));
  assert.throws(() => assertPilotMappingStore("99999"), /Only store 28375 is allowed/);
  assert.throws(() => parseMappingDiscoveryArgs(["--store", "99999"]), /Pilot guard rejected/);
});

test("known pilot mapping remains unchanged and formatter masks candidate IDs", () => {
  const existing = "Ud8d5af30ddca3ed4237e157d5d73c2f1";
  const plan = buildPilotMappingPlan(context([conversation({ lineChatUserId: existing })]), discovery([candidate({ chatUserId: existing })]));
  const report = formatPilotMappingReport(plan, false);
  assert.equal(plan.rows[0].candidateChatUserId, existing);
  assert.equal(plan.rows[0].confidence, "ALREADY_MAPPED");
  assert.equal(report.includes(existing), false);
  assert.match(report, /Ud8d…c2f1/);
});
