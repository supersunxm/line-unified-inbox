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

test("Store Chats header conditionally renders '✓ ตอบแล้วทั้งหมด' ONLY for NOT_REPLIED queue and non-VIEWER roles", () => {
  assert.match(pageCode, /data-bulk-mark-all-replied-button/);
  assert.match(pageCode, /sidebarView === "notReplied" && authUser\?\.role !== "VIEWER"/);
  assert.match(pageCode, /language === "th"\s*\?\s*"ตอบแล้วทั้งหมด"/);
  assert.match(pageCode, /"Mark All Replied"/);
  assert.match(pageCode, /"全部标记为已回复"/);
});

test("Bulk mark as replied displays required confirmation modal with exact title, message, and action buttons", () => {
  // Title
  assert.match(pageCode, /ยืนยันเปลี่ยนสถานะ/);
  assert.match(pageCode, /Confirm Status Change/);
  assert.match(pageCode, /确认更改状态/);

  // Message
  assert.match(pageCode, /คุณกำลังเปลี่ยน <strong>\{bulkConfirmState\.affectedCount\}<\/strong> บทสนทนาเป็น/);
  assert.match(pageCode, /ตอบแล้ว/);

  // Buttons
  assert.match(pageCode, /language === "th" \? "ยกเลิก"/);
  assert.match(pageCode, /language === "th" \? "ยืนยัน"/);
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
