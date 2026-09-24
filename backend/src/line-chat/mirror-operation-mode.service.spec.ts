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
    enteredAt: new Date("2026-09-24T00:00:00.000Z"),
    completedAt: null,
    updatedAt: new Date("2026-09-24T00:00:00.000Z"),
    ...overrides,
  };
}

function testService(input: {
  initial?: MirrorOperationState;
  stores?: Array<{ storeCode: string; lineOfficialAccountId: string }>;
  groups?: Array<{
    lineOfficialAccountId: string;
    historicalBackfillStatus: string | null;
    _count: { _all: number };
  }>;
} = {}) {
  let current = input.initial ?? state();
  let updateManyCalls = 0;
  const prisma = {
    mirrorOperationState: {
      upsert: async ({ create }: { create: MirrorOperationState }) => {
        if (!current) current = create;
        return current;
      },
      updateMany: async (args: {
        where: { mode: string };
        data: Partial<MirrorOperationState>;
      }) => {
        updateManyCalls += 1;
        if (current.mode !== args.where.mode) return { count: 0 };
        current = { ...current, ...args.data, updatedAt: new Date() };
        return { count: 1 };
      },
    },
    lineChatMirrorStoreState: {
      findMany: async () => input.stores ?? [],
    },
    lineChatMirrorChat: {
      groupBy: async () => input.groups ?? [],
    },
  };
  return {
    service: new MirrorOperationModeService(prisma as never),
    prisma,
    current: () => current,
    updateManyCalls: () => updateManyCalls,
  };
}

const allStores = [
  { storeCode: "29113", lineOfficialAccountId: "oa-pinklao" },
  { storeCode: "28375", lineOfficialAccountId: "oa-rbs" },
  { storeCode: "25610", lineOfficialAccountId: "oa-central-world" },
];

const completeGroups = allStores.map((store) => ({
  lineOfficialAccountId: store.lineOfficialAccountId,
  historicalBackfillStatus: HistoricalBackfillStatus.FAST_PATH_COMPLETE,
  _count: { _all: 1 },
}));

test("NORMAL status allows live scheduling and reports reconciliation continues", async () => {
  const { service } = testService();
  const status = await service.getStatus();
  assert.equal(status.mode, "NORMAL");
  assert.equal(status.freezeAt, null);
  assert.equal(status.reconciliationPolicy, "CONTINUE_DATABASE_ONLY");
});

test("NORMAL to BACKFILL persists one freezeAt and the Bangkok lower bound", async () => {
  const { service, current, updateManyCalls } = testService();
  const status = await service.transition("BACKFILL");
  assert.equal(status.mode, "BACKFILL");
  assert.ok(status.freezeAt);
  assert.equal(current().freezeAt?.toISOString(), status.freezeAt);
  assert.equal(status.backfillTargetStartAt, MIRROR_BACKFILL_TARGET_START_AT.toISOString());
  assert.equal(status.backfillTargetStartAt, "2026-08-31T17:00:00.000Z");
  assert.equal(updateManyCalls(), 1);
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

test("repeated BACKFILL request is idempotent and keeps the original freezeAt", async () => {
  const { service, current, updateManyCalls } = testService();
  const first = await service.transition("BACKFILL");
  const frozenAt = current().freezeAt?.toISOString();
  const second = await service.transition("BACKFILL");
  assert.equal(second.freezeAt, frozenAt);
  assert.equal(second.freezeAt, first.freezeAt);
  assert.equal(updateManyCalls(), 1);
});

test("restart reloads BACKFILL and preserves the freeze boundary", async () => {
  const frozenAt = new Date("2026-09-24T01:15:00.000Z");
  const { service, prisma } = testService({
    initial: state({
      mode: "BACKFILL",
      freezeAt: frozenAt,
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
  });
  const restartedService = new MirrorOperationModeService(prisma as never);
  const loaded = await restartedService.getState();
  assert.equal(loaded.mode, "BACKFILL");
  assert.equal(loaded.freezeAt?.toISOString(), frozenAt.toISOString());
});

test("known backward pagination blocker prevents false backfill completion", async () => {
  const { service } = testService({
    initial: state({
      mode: "BACKFILL",
      freezeAt: new Date("2026-09-24T01:15:00.000Z"),
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
    stores: allStores,
    groups: [
      {
        lineOfficialAccountId: "oa-pinklao",
        historicalBackfillStatus: HistoricalBackfillStatus.NEEDS_BACKWARD_PAGINATION,
        _count: { _all: 3 },
      },
    ],
  });
  const status = await service.getStatus();
  assert.equal(status.backfill.status, "BLOCKED");
  assert.equal(status.backfill.reason, "BACKWARD_CONTRACT_UNPROVEN");
  assert.equal(status.backfill.technicallyComplete, false);
  await assert.rejects(service.transition("CATCH_UP"), /MIRROR_BACKFILL_COMPLETION_NOT_PROVEN/);
});

test("proven backfill enters CATCH_UP with the persisted overlap boundary", async () => {
  const frozenAt = new Date("2026-09-24T01:15:00.000Z");
  const { service, current } = testService({
    initial: state({
      mode: "BACKFILL",
      freezeAt: frozenAt,
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
      backfillCoverageStatus: "PROVEN",
    }),
    stores: allStores,
    groups: completeGroups,
  });
  const status = await service.transition("CATCH_UP");
  assert.equal(status.mode, "CATCH_UP");
  assert.equal(status.freezeAt, frozenAt.toISOString());
  assert.equal(status.catchUpStartAt, new Date(frozenAt.getTime() - 300_000).toISOString());
  assert.equal(current().catchUpCoverageStatus, "UNPROVEN");
});

test("CATCH_UP restart retains freezeAt, overlap, and unproven gap status", async () => {
  const frozenAt = new Date("2026-09-24T01:15:00.000Z");
  const catchUpStartAt = new Date(frozenAt.getTime() - 300_000);
  const { service } = testService({
    initial: state({
      mode: "CATCH_UP",
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
  assert.equal(status.freezeAt, frozenAt.toISOString());
  assert.equal(status.catchUpStartAt, catchUpStartAt.toISOString());
  assert.equal(status.catchUp.status, "UNPROVEN");
  await assert.rejects(service.transition("NORMAL"), /MIRROR_CATCH_UP_COMPLETION_NOT_PROVEN/);
});

test("CATCH_UP returns to NORMAL only with durable full-gap proof", async () => {
  const frozenAt = new Date("2026-09-24T01:15:00.000Z");
  const catchUpStartAt = new Date(frozenAt.getTime() - 300_000);
  const { service } = testService({
    initial: state({
      mode: "CATCH_UP",
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
  assert.equal(status.freezeAt, frozenAt.toISOString());
  assert.equal(status.catchUp.status, "PROVEN");
});

test("direct NORMAL to CATCH_UP and BACKFILL to NORMAL are rejected", async () => {
  const normal = testService();
  await assert.rejects(normal.service.transition("CATCH_UP"), /INVALID_MIRROR_MODE_TRANSITION/);
  const backfill = testService({
    initial: state({
      mode: "BACKFILL",
      freezeAt: new Date("2026-09-24T01:15:00.000Z"),
      backfillTargetStartAt: MIRROR_BACKFILL_TARGET_START_AT,
    }),
  });
  await assert.rejects(backfill.service.transition("NORMAL"), /INVALID_MIRROR_MODE_TRANSITION/);
});
