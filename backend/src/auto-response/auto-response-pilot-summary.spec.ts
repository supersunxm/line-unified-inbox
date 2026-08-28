import assert from "node:assert/strict";
import test from "node:test";
import { AutoResponseExecutionOutcome, AutoResponseIntent } from "@prisma/client";
import { AutoResponseService } from "./auto-response.service";

test("pilot summary is admin-read-only and returns aggregate outcomes without message content", async () => {
  const calls: string[] = [];
  const prisma = {
    message: { count: async ({ where }: any) => { calls.push("message.count"); assert.equal(where.direction, "INBOUND"); assert.equal(where.messageType, "TEXT"); assert.equal(where.conversation.store.code, "28375"); assert.equal(where.conversation.store.storeMaster.externalStoreId, "28375"); return 12; } },
    autoResponseExecution: {
      count: async ({ where }: any) => {
        calls.push(`execution.count:${where.outcome ?? where.intent ?? "other"}`);
        assert.equal(where.lineOfficialAccount.store.code, "28375");
        assert.equal(where.lineOfficialAccount.store.storeMaster.externalStoreId, "28375");
        if (where.outcome === AutoResponseExecutionOutcome.EXCLUDED) return 3;
        if (where.outcome === AutoResponseExecutionOutcome.AMBIGUOUS) return 1;
        if (where.outcome === AutoResponseExecutionOutcome.NO_MATCH) return 4;
        if (where.outcome === AutoResponseExecutionOutcome.SENT) return 1;
        if (where.outcome === AutoResponseExecutionOutcome.FAILED) return 0;
        if (where.outcome === AutoResponseExecutionOutcome.DUPLICATE) return 0;
        if (where.intent === AutoResponseIntent.STORE_LOCATION) return 2;
        if (where.intent === AutoResponseIntent.FINANCE_INFO) return 1;
        return 0;
      },
      findMany: async () => [{ intent: AutoResponseIntent.STORE_LOCATION, outcome: AutoResponseExecutionOutcome.MATCHED_SHADOW, mode: "SHADOW", reason: null, createdAt: new Date() }],
    },
  } as any;
  const service = new AutoResponseService(prisma);
  const summary = await service.getPilotSummary();
  assert.equal(summary.storeExternalId, "28375");
  assert.equal(summary.counts.totalEligibleInboundTexts, 12);
  assert.equal(summary.counts.excluded, 3);
  assert.equal(summary.counts.ambiguous, 1);
  assert.equal(summary.counts.noMatch, 4);
  assert.equal(summary.recent[0].intent, AutoResponseIntent.STORE_LOCATION);
  assert.deepEqual(calls.filter((call) => call.includes("create") || call.includes("update")), []);
});
