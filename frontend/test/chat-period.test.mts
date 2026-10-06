import assert from "node:assert/strict";
import test from "node:test";

import {
  CHAT_REPLY_STATUS_COVERAGE_MONTH,
  getChatPeriodOptions,
  getCurrentBangkokMonth,
  isReplyStatusCovered,
  isSelectableChatPeriod,
} from "../src/app/chat-period.ts";

test("Store Chats period starts at September 2026 and defaults to Bangkok current month", () => {
  const now = new Date("2026-10-06T08:40:00.000Z");
  assert.equal(CHAT_REPLY_STATUS_COVERAGE_MONTH, "2026-09");
  assert.equal(getCurrentBangkokMonth(now), "2026-10");
  assert.deepEqual(getChatPeriodOptions("th", now).map(({ value }) => value), ["2026-10", "2026-09", "all"]);
  assert.equal(isSelectableChatPeriod("2026-08", now), false);
  assert.equal(isSelectableChatPeriod("2026-09", now), true);
  assert.equal(isSelectableChatPeriod("all", now), true);
});

test("reply status is absent before 1 September Bangkok", () => {
  assert.equal(isReplyStatusCovered("2026-08-31T16:59:59.999Z"), false);
  assert.equal(isReplyStatusCovered("2026-08-31T17:00:00.000Z"), true);
});
