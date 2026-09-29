import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");

test("API client provides bulkMarkReplied and bulkMarkRepliedByFilter endpoints", () => {
  assert.match(apiCode, /bulkMarkReplied: \(conversationIds: string\[\]\)/);
  assert.match(apiCode, /request<\{ success: boolean; updatedCount: number; affectedCount: number; storeId: string; status: ApiBmReplyStatus \}>\("\/conversations\/bulk-mark-replied", \{/);
  assert.match(apiCode, /bulkMarkRepliedByFilter: \(input: \{ bmReplyStatus\?: ApiBmReplyStatus; storeId\?: string \}\)/);
  assert.match(apiCode, /request<\{ success: boolean; updatedCount: number; affectedCount: number; storeId: string; status: ApiBmReplyStatus \}>\("\/conversations\/bulk-mark-replied-by-filter", \{/);
});

test("Store Chats no longer exposes manual bulk reply-state mutation controls", () => {
  assert.doesNotMatch(pageCode, /data-bulk-mark-all-replied-button/);
  assert.doesNotMatch(pageCode, /"Mark All Replied"/);
  assert.doesNotMatch(pageCode, /"全部标记为已回复"/);
});

test("legacy bulk mutation plumbing remains backend-compatible but is not a reply-state source of truth", () => {
  assert.match(apiCode, /bulkMarkRepliedByFilter/);
  assert.match(pageCode, /const handleExecuteBulkUpdate = useCallback/);
  assert.doesNotMatch(pageCode, /onRequestBulkUpdate=\{/);
});

test("Executing bulk update triggers reconciliation: calls bulkMarkRepliedByFilter, refreshes conversation list, and updates counters", () => {
  assert.match(pageCode, /const handleExecuteBulkUpdate = useCallback\(async \(\) =>/);
  assert.match(pageCode, /api\.bulkMarkRepliedByFilter\(\{/);
  assert.match(pageCode, /api\.bmReplyStatusSummary\(\)/);
  assert.match(pageCode, /api\.stores\(showArchivedStores\)/);
  assert.match(pageCode, /loadConversations\(conversationQueryRef\.current, true\)/);
  assert.match(pageCode, /setBmSummaryData\(bmSummaryRes\)/);
  assert.match(pageCode, /language === "th"\s*\?\s*`อัปเดต \$\{count\} บทสนทนาเรียบร้อย`/);
});
