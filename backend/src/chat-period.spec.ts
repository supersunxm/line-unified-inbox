import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_REPLY_STATUS_COVERAGE_START,
  isChatReplyStatusCovered,
  resolveChatMonthRange,
} from "./chat-period";

void test("chat month range uses Bangkok calendar boundaries", () => {
  assert.deepEqual(resolveChatMonthRange("2026-10"), {
    gte: new Date("2026-09-30T17:00:00.000Z"),
    lt: new Date("2026-10-31T17:00:00.000Z"),
  });
  assert.equal(resolveChatMonthRange("all"), null);
  assert.equal(resolveChatMonthRange(undefined), null);
});

void test("reply status coverage starts at 1 Sep 2026 Bangkok time", () => {
  assert.equal(CHAT_REPLY_STATUS_COVERAGE_START.toISOString(), "2026-08-31T17:00:00.000Z");
  assert.equal(isChatReplyStatusCovered(new Date("2026-08-31T16:59:59.999Z")), false);
  assert.equal(isChatReplyStatusCovered(new Date("2026-08-31T17:00:00.000Z")), true);
});
