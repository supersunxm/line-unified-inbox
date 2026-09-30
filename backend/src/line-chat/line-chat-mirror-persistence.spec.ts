import assert from "node:assert/strict";
import test from "node:test";
import { LineChatMirrorDirection } from "@prisma/client";
import { persistLineChatMirrorHistoryBatch } from "./line-chat-mirror-persistence";

const event = (id: string, text = id) => ({
  managerMessageId: id,
  eventType: "messageSent",
  direction: LineChatMirrorDirection.OUTBOUND,
  messageType: "text",
  text,
  fileName: null,
  bizId: "synthetic-owner",
  ownerName: "Synthetic Owner",
  sentAt: new Date("2026-09-30T00:00:00.000Z"),
});

test("bulk persistence deduplicates event IDs and keeps the last observed event", async () => {
  const queries: Array<{ sql: string; values: unknown[] }> = [];
  const count = await persistLineChatMirrorHistoryBatch(async (query) => {
    queries.push(query);
    return 1;
  }, {
    lineOfficialAccountId: "synthetic-oa",
    lineChatUserId: "synthetic-chat",
    events: [event("same", "older"), event("same", "newer"), event("another")],
  });

  assert.equal(count, 2);
  assert.equal(queries.length, 1);
  assert.match(queries[0].sql, /ON CONFLICT \("lineOfficialAccountId", "managerMessageId"\) DO UPDATE/);
  assert.match(queries[0].sql, /IS DISTINCT FROM/);
  assert.match(queries[0].sql, /ELSE existing\."updatedAt"/);
  assert.equal(queries[0].values.includes("newer"), true);
  assert.equal(queries[0].values.includes("older"), false);
});

test("bulk persistence chunks large history responses into bounded SQL statements", async () => {
  const sizes: number[] = [];
  const count = await persistLineChatMirrorHistoryBatch(async (query) => {
    sizes.push(query.values.length);
    return 1;
  }, {
    lineOfficialAccountId: "synthetic-oa",
    lineChatUserId: "synthetic-chat",
    events: Array.from({ length: 205 }, (_, index) => event(`event-${index}`)),
  });

  assert.equal(count, 205);
  assert.equal(sizes.length, 3);
  assert.deepEqual(sizes.map((size) => size / 12), [100, 100, 5]);
});

test("bulk persistence ignores invalid timestamps and does no empty SQL write", async () => {
  let writes = 0;
  const count = await persistLineChatMirrorHistoryBatch(async () => {
    writes += 1;
    return 1;
  }, {
    lineOfficialAccountId: "synthetic-oa",
    lineChatUserId: "synthetic-chat",
    events: [{ ...event("invalid"), sentAt: new Date(Number.NaN) }],
  });

  assert.equal(count, 0);
  assert.equal(writes, 0);
});
