import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getBmReplyStatusBadge } from "../src/app/conversation-list-presentation.ts";

const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");

test("bmReplyStatusLabels provides exact required Thai, English, and Chinese translations", () => {
  assert.match(pageCode, /bmReplyStatusLabels: Record<Language, Record<ApiBmReplyStatus, string>> = \{/);
  assert.match(pageCode, /th: \{[\s\S]*NOT_REPLIED: "ยังไม่ตอบ"[\s\S]*NOTIFIED_BM: "แจ้ง BM แล้ว"[\s\S]*REPLIED: "ตอบแล้ว"/);
  assert.match(pageCode, /en: \{[\s\S]*NOT_REPLIED: "Not replied"[\s\S]*NOTIFIED_BM: "BM notified"[\s\S]*REPLIED: "Replied"/);
  assert.match(pageCode, /zh: \{[\s\S]*NOT_REPLIED: "尚未回复"[\s\S]*NOTIFIED_BM: "已通知 BM"[\s\S]*REPLIED: "已回复"/);

  const thBadge = getBmReplyStatusBadge("NOT_REPLIED", { NOT_REPLIED: "ยังไม่ตอบ", NOTIFIED_BM: "แจ้ง BM แล้ว", REPLIED: "ตอบแล้ว" });
  assert.equal(thBadge.label, "ยังไม่ตอบ");
  const enBadge = getBmReplyStatusBadge("NOTIFIED_BM", { NOT_REPLIED: "Not replied", NOTIFIED_BM: "BM notified", REPLIED: "Replied" });
  assert.equal(enBadge.label, "BM notified");
  const zhBadge = getBmReplyStatusBadge("REPLIED", { NOT_REPLIED: "尚未回复", NOTIFIED_BM: "已通知 BM", REPLIED: "已回复" });
  assert.equal(zhBadge.label, "已回复");
});

test("detail view contains 3-state bmReplyStatus control disabled for VIEWER role", () => {
  assert.match(pageCode, /data-bm-reply-status-select/);
  assert.match(pageCode, /disabled=\{isMutating \|\| authUser\?\.role === "VIEWER"\}/);
  assert.match(pageCode, /onChange=\{\(e\) => void updateBmReplyStatus\(e\.target\.value as ApiBmReplyStatus\)\}/);
  assert.match(apiCode, /updateBmReplyStatus: \(id: string, status: ApiBmReplyStatus\)/);
  assert.match(pageCode, /const response = await api\.updateBmReplyStatus\(selectedConversation\.id, status\)/);
});

test("updateBmReplyStatus follows optimistic update + rollback pattern", () => {
  const funcStart = pageCode.indexOf("async function updateBmReplyStatus");
  const funcEnd = pageCode.indexOf("function updateInternalNote", funcStart);
  const funcBody = pageCode.slice(funcStart, funcEnd);

  assert.match(funcBody, /if \(!selectedConversation \|\| isMutating \|\| authUser\?\.role === "VIEWER"\) return;/);
  assert.match(funcBody, /setConversationStates\(\(currentStates\) =>/);
  assert.match(funcBody, /bmReplyStatus: status/);
  assert.match(funcBody, /completesFollowUp \? \{ status: "completed" \} : \{\}/);
  assert.match(funcBody, /await api\.updateBmReplyStatus/);
  assert.match(funcBody, /setConversationStates\(\(currentStates\) => \(\{[\s\S]*previousState/);
});

test("activity history mapping and rendering recognizes BM_REPLY_STATUS_CHANGED", () => {
  assert.match(pageCode, /activity\.actionType === "BM_REPLY_STATUS_CHANGED" && activity\.newBmReplyStatus/);
  assert.match(pageCode, /actionType: "bmReplyStatus"/);
  assert.match(pageCode, /activity\.actionType === "bmReplyStatus" && activity\.bmReplyStatus/);
  assert.match(pageCode, /bmReplyStatusChangedTo/);
});
