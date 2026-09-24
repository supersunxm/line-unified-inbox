import assert from "node:assert/strict";
import test from "node:test";
import type { MirrorOperationState } from "@prisma/client";
import {
  DEFAULT_CATCH_UP_OVERLAP_SECONDS,
  MIRROR_BACKFILL_TARGET_START_AT,
  MIRROR_OPERATION_STATE_ID,
  MirrorOperationModeService,
} from "./mirror-operation-mode.service";
import { HistoricalBackfillStatus } from "./line-chat-historical-backfill";

function state(overrides: Partial<MirrorOperationState> = {}): MirrorOperationState {
  return {
    id: MIRROR_OPERATION_STATE_ID,
    mode: "NORMAL",
    runId: null,
    freezeAt: null,
    backfillTargetStartAt: null,
    catchUpOverlapSeconds: DEFAULT_CATCH_UP_OVERLAP_SECONDS,
    catchUpStartAt: null,
    backfillCoverageStatus: "UNPROVEN",
    catchUpCoverageStatus: "UNPROVEN",
    catchUpObservedThroughAt: null,
    catchUpStoresTotal: 0,
    catchUpStoresComplete: 0,
    catchUpStoresPending: 0,
    catchUpStoresFailed: 0,
    catchUpEarliestUncoveredAt: null,
    recoveryRequired: false,
    emergencyResumedAt: null,
    emergencyResumeReason: null,
    enteredAt: new Date("2026-09-24T00:00:00.000Z"),
    completedAt: null,
    updatedAt: new Date("2026-09-24T00:00:00.000Z"),
    ...overrides,
  };
}

const allStores = [
  { storeCode: "29113", lineOfficialAccountId: "oa-pinklao" },
  { storeCode: "28375", lineOfficialAccountId: "oa-rbs" },
  { storeCode: "25610", lineOfficialAccountId: "oa-central-world" },
];

type CohortStore = {
  runId: string;
  storeCode: string;
  lineOfficialAccountId: string;
  inventoryStatus: "UNPROVEN" | "PROVEN";
  observedConversations: number;
  exactSeptemberChats: number | null;
  inventoryCompletedAt: Date | null;
};

type CohortConversation = {
  runId: string;
  storeCode: string;
  lineOfficialAccountId: string;
  lineChatUserId: string;
  observedLastMessageAt: Date | null;
};

function testService(input: {
  initial?: MirrorOperationState;
  stores?: Array<{ storeCode: string; lineOfficialAccountId: string }>;
  knownChats?: Array<{
    lineOfficialAccountId: string;
    lineChatUserId: string;
    lastMessageAt: Date | null;
    historicalBackfillStatus?: string | null;
  }>;
  cohortStores?: CohortStore[];
  cohortConversations?: CohortConversation[];
} = {}) {
  let current = input.initial ?? state();
  let updateManyCalls = 0;
  const storeStates = input.stores ?? allStores;
  const knownChats = [...(input.knownChats ?? [])];
  const cohortStores = new Map<string, CohortStore>(
    (input.cohortStores ?? []).map((row) => [`${row.runId}:${row.storeCode}`, { ...row }]),
  );
  let cohortConversations = [...(input.cohortConversations ?? [])];

  const prisma = {
    mirrorOperationState: {
      upsert: async () => current,
      updateMany: async (args: {
        where: { mode?: string; runId?: string; freezeAt?: Date | null };
        data: Partial<MirrorOperationState>;
      }) => {
        updateManyCalls += 1;
        if (args.where.mode && current.mode !== args.where.mode) return { count: 0 };
        if (args.where.runId && current.runId !== args.where.runId) return { count: 0 };
        if (
          args.where.freezeAt
          && current.freezeAt?.getTime() !== args.where.freezeAt.getTime()
        ) return { count: 0 };
        current = { ...current, ...args.data, updatedAt: new Date() };
        return { count: 1 };
      },
    },
    lineChatMirrorStoreState: {
      findMany: async () => storeStates,
    },
    lineChatMirrorChat: {
      findMany: async (args: {
        where: {
          lineOfficialAccountId: string;
          lineChatUserId?: { in: string[] };
          lastMessageAt?: { gte: Date; lte: Date };
        };
        select: Record<string, boolean>;
      }) => {
        let rows = knownChats.filter(
          (row) => row.lineOfficialAccountId === args.where.lineOfficialAccountId,
        );
        if (args.where.lineChatUserId) {
          const allowed = new Set(args.where.lineChatUserId.in);
          rows = rows.filter((row) => allowed.has(row.lineChatUserId));
        }
        if (args.where.lastMessageAt) {
          rows = rows.filter((row) =>
            row.lastMessageAt
            && row.lastMessageAt >= args.where.lastMessageAt!.gte
            && row.lastMessageAt <= args.where.lastMessageAt!.lte,
          );
        }
        return rows.map((row) => ({
          lineChatUserId: row.lineChatUserId,
          lastMessageAt: row.lastMessageAt,
          historicalBackfillStatus: row.historicalBackfillStatus ?? null,
        }));
      },
    },
    mirrorBackfillStoreCohort: {
      upsert: async (args: {
        where: { runId_storeCode: { runId: string; storeCode: string } };
        update: Partial<CohortStore>;
        create: CohortStore;
      }) => {
        const key = `${args.where.runId_storeCode.runId}:${args.where.runId_storeCode.storeCode}`;
        const existing = cohortStores.get(key);
        if (existing) {
          const next = { ...existing, ...args.update };
          cohortStores.set(key, next);
          return next;
        }
        const created: CohortStore = {
          inventoryStatus: "UNPROVEN",
          observedConversations: 0,
          exactSeptemberChats: null,
          inventoryCompletedAt: null,
          ...args.create,
        };
        cohortStores.set(key, created);
        return created;
      },
      update: async (args: {
        where: { runId_storeCode: { runId: string; storeCode: string } };
        data: Partial<CohortStore>;
      }) => {
        const key = `${args.where.runId_storeCode.runId}:${args.where.runId_storeCode.storeCode}`;
        const existing = cohortStores.get(key);
        if (!existing) throw new Error("cohort store missing");
        const next = { ...existing, ...args.data };
        cohortStores.set(key, next);
        return next;
      },
      findMany: async (args: { where: { runId: string; storeCode: { in: string[] } } }) =>
        [...cohortStores.values()].filter(
          (row) => row.runId === args.where.runId && args.where.storeCode.in.includes(row.storeCode),
        ),
    },
    mirrorBackfillConversation: {
      createMany: async (args: { data: CohortConversation[]; skipDuplicates?: boolean }) => {
        for (const row of args.data) {
          const exists = cohortConversations.some((item) =>
            item.runId === row.runId
            && item.lineOfficialAccountId === row.lineOfficialAccountId
            && item.lineChatUserId === row.lineChatUserId,
          );
          if (!exists) cohortConversations.push({ ...row });
        }
        return { count: args.data.length };
      },
      deleteMany: async (args: { where: { runId: string; storeCode: string } }) => {
        const before = cohortConversations.length;
        cohortConversations = cohortConversations.filter(
          (row) => !(row.runId === args.where.runId && row.storeCode === args.where.storeCode),
        );
        return { count: before - cohortConversations.length };
      },
      count: async (args: { where: { runId: string; storeCode: string } }) =>
        cohortConversations.filter(
          (row) => row.runId === args.where.runId && row.storeCode === args.where.storeCode,
        ).length,
      findMany: async (args: {
        where: { runId: string; storeCode: string; lineOfficialAccountId?: string };
      }) => cohortConversations.filter(
        (row) => row.runId === args.where.runId
          && row.storeCode === args.where.storeCode
          && (!args.where.lineOfficialAccountId
            || row.lineOfficialAccountId === args.where.lineOfficialAccountId),
      ),
    },
  };

  return {
    service: new MirrorOperationModeService(prisma as never),
    current: () => current,
    updateManyCalls: () => updateManyCalls,
    cohortStores,
    cohortConversations: () => cohortConversations,
  };
}

function provenCohort(runId: string, statuses: string[]) {
  const cohortStores: CohortStore[] = [];
  const cohortConversations: CohortConversation[] = [];
  const knownChats: NonNullable<Parameters<typeof testService>[0]["knownChats"]> = [];

  allStores.forEach((store, storeIndex) => {
    const lineChatUserId = `chat-${storeIndex}`;
    cohortStores.push({
      runId,
      storeCode: store.storeCode,
      lineOfficialAccountId: store.lineOfficialAccountId,
      inventoryStatus: "PROVEN",
      observedConversations: 1,
      exactSeptemberChats: 1,
      inventoryCompletedAt: new Date("2026-09-24T01:00:00.000Z"),
    });
    cohortConversations.push({
      runId,
      storeCode: store.storeCode,
      lineOfficialAccountId: store.lineOfficialAccountId,
      lineChatUserId,
      observedLastMessageAt: new Date("2026-09-20T00:00:00.000Z"),
    });
    knownChats.push({
      lineOfficialAccountId: store.lineOfficialAccountId,
      lineChatUserId,
      lastMessageAt: new Date("2026-09-25T00:00:00.000Z"),
      historicalBackfillStatus: statuses[storeIndex] ?? HistoricalBackfillStatus.FAST_PATH_COMPLETE,
    });
  });
  return { cohortStores, cohortConversations, knownChats };
}

test("NORMAL status allows live scheduling and reports reconciliation continues", async () => {
  const { service } = testService();
  const status = await service.getStatus();
  assert.equal(status.mode, "NORMAL");
  assert.equal(status.freezeAt, null);
  assert.equal(status.recoveryRequired, false);
  assert.equal(status.reconciliationPolicy, "CONTINUE_DATABASE_ONLY");
});

test("NORMAL to BACKFILL persists one freezeAt, runId, and the Bangkok lower bound", async () => {
  const { service, current } = testService();
  const status = await service.transition("BACKFILL");
  assert.equal(status.mode, "BACKFILL");
  assert.ok(status.freezeAt);
  assert.ok(status.runId);
  assert.equal(current().freezeAt?.toISOString(), status.freezeAt);
  assert.equal(current().runId, status.runId);
  assert.equal(status.backfillTargetStartAt, "2026-08-31T17:00:00.000Z");
});

test("mode transition telemetry contains aggregate safe fields only", async () => {
  const { service } = testService();
  const logs: string[] = [];
  Object.defineProperty(service, "logger", {
    configurable: true,
    value: { log: (message: string) => logs.push(message), warn: (message: string) => logs.push(message) },
  });
  await service.transition("BACKFILL");
  assert.ok(logs.some((line) => line.includes("mirror_operation_mode_transition_completed")));
  assert.ok(logs.every((line) => !/customer|chatUserId|lineUserId|messageText|cookie|token|cursor|backward/iu.test(line)));
});

test("repeated BACKFILL request is idempotent and keeps the original freezeAt and runId", async () => {
  const { service, current } = testService();
  const first = await service.transition("BACKFILL");
  const freezeAt = current().freezeAt?.toISOString();
  const runId = current().runId;
  const second = await service.transition("BACKFILL");
  assert.equal(second.freezeAt, freezeAt);
  assert.equal(second.runId, runId);
  assert.equal(second.freezeAt, first.freezeAt);
});

test("restart reloads BACKFILL and preserves the freeze boundary", async () => {
  const frozenAt = new Date("2026-09-24T01:15:00.000Z");
  const { service } = testService({
    initial: state({
      mode: "BACKFILL",
      runId: "run-1",
      freezeAt: frozenAt,
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
  });
  const loaded = await service.getState();
  assert.equal(loaded.mode, "BACKFILL");
  assert.equal(loaded.runId, "run-1");
  assert.equal(loaded.freezeAt?.toISOString(), frozenAt.toISOString());
});

test("completed inventory replaces the store cohort with a durable exact snapshot", async () => {
  const { service, cohortStores, cohortConversations } = testService({
    initial: state({
      mode: "BACKFILL",
      runId: "run-1",
      freezeAt: new Date("2026-09-24T01:15:00.000Z"),
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
  });
  await service.recordBackfillInventory({
    storeCode: "29113",
    lineOfficialAccountId: "oa-pinklao",
    conversations: [
      { lineChatUserId: "chat-a", lastMessageAt: new Date("2026-09-20T00:00:00.000Z") },
      { lineChatUserId: "chat-b", lastMessageAt: new Date("2026-09-21T00:00:00.000Z") },
    ],
    inventoryComplete: true,
    exactSeptemberChats: 2,
  });
  assert.equal(cohortConversations().filter((row) => row.storeCode === "29113").length, 2);
  assert.equal(cohortStores.get("run-1:29113")?.inventoryStatus, "PROVEN");
  assert.equal(cohortStores.get("run-1:29113")?.exactSeptemberChats, 2);
});

test("known backward pagination blocker prevents false backfill completion", async () => {
  const runId = "run-blocked";
  const proof = provenCohort(runId, [
    HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION,
    HistoricalBackfillStatus.FAST_PATH_COMPLETE,
    HistoricalBackfillStatus.FAST_PATH_COMPLETE,
  ]);
  const { service } = testService({
    initial: state({
      mode: "BACKFILL",
      runId,
      freezeAt: new Date("2026-09-24T01:15:00.000Z"),
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
    ...proof,
  });
  const status = await service.getStatus();
  assert.equal(status.backfill.status, "BLOCKED");
  assert.equal(status.backfill.reason, "BACKWARD_CONTRACT_UNPROVEN");
  assert.equal(status.backfill.technicallyComplete, false);
  await assert.rejects(service.transition("CATCH_UP"), /MIRROR_BACKFILL_COMPLETION_NOT_PROVEN/);
});

test("durable cohort membership survives mutable lastMessageAt after freeze", async () => {
  const runId = "run-mutable-last-message";
  const proof = provenCohort(runId, [
    HistoricalBackfillStatus.FAST_PATH_COMPLETE,
    HistoricalBackfillStatus.FAST_PATH_COMPLETE,
    HistoricalBackfillStatus.FAST_PATH_COMPLETE,
  ]);
  assert.ok(proof.knownChats.every((chat) =>
    chat.lastMessageAt!.getTime() > new Date("2026-09-24T01:15:00.000Z").getTime(),
  ));
  const { service } = testService({
    initial: state({
      mode: "BACKFILL",
      runId,
      freezeAt: new Date("2026-09-24T01:15:00.000Z"),
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
    ...proof,
  });
  const status = await service.getStatus();
  assert.equal(status.backfill.status, "COMPLETE");
  assert.equal(status.backfill.cohortInventoryStatus, "PROVEN");
});

test("proven backfill enters CATCH_UP with the persisted overlap boundary", async () => {
  const runId = "run-complete";
  const frozenAt = new Date("2026-09-24T01:15:00.000Z");
  const proof = provenCohort(runId, [
    HistoricalBackfillStatus.FAST_PATH_COMPLETE,
    HistoricalBackfillStatus.FAST_PATH_COMPLETE,
    HistoricalBackfillStatus.FAST_PATH_COMPLETE,
  ]);
  const { service, current } = testService({
    initial: state({
      mode: "BACKFILL",
      runId,
      freezeAt: frozenAt,
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
    ...proof,
  });
  const status = await service.transition("CATCH_UP");
  assert.equal(status.mode, "CATCH_UP");
  assert.equal(status.freezeAt, frozenAt.toISOString());
  assert.equal(status.catchUpStartAt, new Date(frozenAt.getTime() - 300_000).toISOString());
  assert.equal(current().backfillCoverageStatus, "PROVEN");
});

test("CATCH_UP restart retains freezeAt, overlap, and unproven gap status", async () => {
  const frozenAt = new Date("2026-09-24T01:15:00.000Z");
  const catchUpStartAt = new Date(frozenAt.getTime() - 300_000);
  const { service } = testService({
    initial: state({
      mode: "CATCH_UP",
      runId: "run-1",
      freezeAt: frozenAt,
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
      catchUpStartAt,
      catchUpStoresTotal: 16,
      catchUpStoresPending: 16,
      catchUpEarliestUncoveredAt: catchUpStartAt,
    }),
  });
  const status = await service.getStatus();
  assert.equal(status.mode, "CATCH_UP");
  assert.equal(status.catchUp.status, "UNPROVEN");
  await assert.rejects(service.transition("NORMAL"), /MIRROR_CATCH_UP_COMPLETION_NOT_PROVEN/);
});

test("CATCH_UP returns to NORMAL only with durable full-gap proof", async () => {
  const frozenAt = new Date("2026-09-24T01:15:00.000Z");
  const catchUpStartAt = new Date(frozenAt.getTime() - 300_000);
  const { service } = testService({
    initial: state({
      mode: "CATCH_UP",
      runId: "run-1",
      freezeAt: frozenAt,
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
      catchUpStartAt,
      catchUpCoverageStatus: "PROVEN",
      catchUpObservedThroughAt: new Date("2026-09-24T01:20:00.000Z"),
      catchUpStoresTotal: 16,
      catchUpStoresComplete: 16,
      catchUpEarliestUncoveredAt: null,
    }),
  });
  const status = await service.transition("NORMAL");
  assert.equal(status.mode, "NORMAL");
  assert.equal(status.recoveryRequired, false);
});

test("emergency resume is explicit, restores NORMAL, and preserves an unresolved recovery marker", async () => {
  const { service, current } = testService({
    initial: state({
      mode: "BACKFILL",
      runId: "run-emergency",
      freezeAt: new Date("2026-09-24T01:15:00.000Z"),
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
  });
  await assert.rejects(
    service.emergencyResume({ acknowledgeUnprovenGap: false, reason: "operator recovery" }),
    /MIRROR_EMERGENCY_RESUME_ACK_REQUIRED/,
  );
  const status = await service.emergencyResume({
    acknowledgeUnprovenGap: true,
    reason: "restore live polling while preserving the unresolved gap",
  });
  assert.equal(status.mode, "NORMAL");
  assert.equal(status.recoveryRequired, true);
  assert.ok(status.emergencyResumedAt);
  assert.equal(current().runId, "run-emergency");
  await assert.rejects(service.transition("BACKFILL"), /MIRROR_RECOVERY_REQUIRED/);
});

test("direct NORMAL to CATCH_UP and BACKFILL to NORMAL are rejected", async () => {
  const normal = testService();
  await assert.rejects(normal.service.transition("CATCH_UP"), /INVALID_MIRROR_MODE_TRANSITION/);
  const backfill = testService({
    initial: state({
      mode: "BACKFILL",
      runId: "run-1",
      freezeAt: new Date("2026-09-24T01:15:00.000Z"),
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
  });
  await assert.rejects(backfill.service.transition("NORMAL"), /INVALID_MIRROR_MODE_TRANSITION/);
});
