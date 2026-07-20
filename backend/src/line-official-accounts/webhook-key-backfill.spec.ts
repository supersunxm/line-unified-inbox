import assert from "node:assert/strict";
import test from "node:test";
import { backfillWebhookKeys } from "./webhook-key-backfill";

void test("backfill repairs incomplete records without touching existing keys", async () => {
  const updated: Array<{ id: string; key: string }> = [];
  const client = {
    $queryRawUnsafe: () => Promise.resolve([{ id: "missing-1" }, { id: "blank-2" }]),
    lineOfficialAccount: { update: ({ where, data }: { where: { id: string }; data: { webhookKey: string } }) => { updated.push({ id: where.id, key: data.webhookKey }); return Promise.resolve({}); } },
  };
  let sequence = 0;
  const result = await backfillWebhookKeys(client as never, () => `generated-${sequence += 1}`);
  assert.deepEqual(result, { scanned: 2, repaired: 2 });
  assert.deepEqual(updated, [{ id: "missing-1", key: "generated-1" }, { id: "blank-2", key: "generated-2" }]);
  assert.equal(updated.some(({ id }) => id === "existing-key-record"), false);
});
