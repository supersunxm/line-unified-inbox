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

test("Store Chats All mode provides operational reply status note translations", async () => {
  const { readFileSync } = await import("node:fs");
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const contextSidebarCode = readFileSync(new URL("../src/components/shell/context-sidebar.tsx", import.meta.url), "utf8");
  const mobileChatsCode = readFileSync(new URL("../src/app/chats/page.tsx", import.meta.url), "utf8");

  // Verify translations in page.tsx
  assert.match(pageCode, /th: \{[\s\S]*replyStatusCoverageNote: "สถานะตอบกลับนับตั้งแต่ ก\.ย\. 2026"/);
  assert.match(pageCode, /en: \{[\s\S]*replyStatusCoverageNote: "Reply status counted from Sep 2026"/);
  assert.match(pageCode, /zh: \{[\s\S]*replyStatusCoverageNote: "回复状态从 2026 年 9 月起统计"/);

  // Verify desktop context sidebar displays note and does not hide operational buttons or counts
  assert.match(contextSidebarCode, /period === "all" && \([\s\S]*replyStatusCoverageNote/);
  assert.doesNotMatch(contextSidebarCode, /\{period !== "all" && \([\s\S]*selectSidebarView\("notReplied"\)/);

  // Verify mobile chat bridge displays note and exposes all status buttons
  assert.match(mobileChatsCode, /replyStatusCoverageNote: "สถานะตอบกลับนับตั้งแต่ ก\.ย\. 2026"/);
  assert.match(mobileChatsCode, /replyStatusCoverageNote: "Reply status counted from Sep 2026"/);
  assert.match(mobileChatsCode, /replyStatusCoverageNote: "回复状态从 2026 年 9 月起统计"/);
  assert.match(mobileChatsCode, /month === "all" && \([\s\S]*labels\.replyStatusCoverageNote/);
  assert.doesNotMatch(mobileChatsCode, /month === "all"\s*\?\s*\[\["all",\s*labels\.all\]\]/);
});

