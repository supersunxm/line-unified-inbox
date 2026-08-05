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

test("sidebar OVERVIEW section renders global bmReplyStatus categories and per-store 3-badge breakdown", () => {
  const contextSidebarCode = readFileSync(new URL("../src/components/shell/context-sidebar.tsx", import.meta.url), "utf8");
  assert.match(contextSidebarCode, /selectSidebarView\("notReplied"\)/);
  assert.match(contextSidebarCode, /selectSidebarView\("notifiedBm"\)/);
  assert.match(contextSidebarCode, /selectSidebarView\("replied"\)/);
  assert.match(contextSidebarCode, /overview\.notReplied/);
  assert.match(contextSidebarCode, /overview\.notifiedBm/);
  assert.match(contextSidebarCode, /overview\.replied/);
  assert.match(contextSidebarCode, /storeBmCounts\[store\.id\]/);

  assert.match(pageCode, /api\.bmReplyStatusSummary/);
  assert.match(pageCode, /bmReplyStatus: initialSection === "chats" \? activeConversationBmReplyStatus : undefined/);
  assert.match(pageCode, /NOT_REPLIED/);
  assert.match(pageCode, /NOTIFIED_BM/);
  assert.match(pageCode, /REPLIED/);
});

test("sortStoresByPriority prioritizes stores by operational urgency (notReplied -> notifiedBm -> replied -> alphabetical)", async () => {
  const { sortStoresByPriority } = await import("../src/components/shell/store-priority-sorting.ts");

  // Case 1: Higher notReplied count appears first
  const storesCase1 = [
    { id: "store-a", name: "Store A" },
    { id: "store-b", name: "Store B" },
  ];
  const countsCase1 = {
    "store-a": { notReplied: 5, notifiedBm: 0, replied: 0 },
    "store-b": { notReplied: 20, notifiedBm: 0, replied: 0 },
  };
  const sortedCase1 = sortStoresByPriority(storesCase1, countsCase1);
  assert.deepEqual(sortedCase1.map((s) => s.id), ["store-b", "store-a"]);

  // Case 2: Equal notReplied -> Higher notifiedBm count appears first
  const storesCase2 = [
    { id: "store-a", name: "Store A" },
    { id: "store-b", name: "Store B" },
  ];
  const countsCase2 = {
    "store-a": { notReplied: 10, notifiedBm: 2, replied: 0 },
    "store-b": { notReplied: 10, notifiedBm: 5, replied: 0 },
  };
  const sortedCase2 = sortStoresByPriority(storesCase2, countsCase2);
  assert.deepEqual(sortedCase2.map((s) => s.id), ["store-b", "store-a"]);

  // Case 3: All counts equal -> Alphabetical by store name
  const storesCase3 = [
    { id: "store-z", name: "Zebra Store" },
    { id: "store-a", name: "Alpha Store" },
  ];
  const countsCase3 = {
    "store-z": { notReplied: 5, notifiedBm: 2, replied: 1 },
    "store-a": { notReplied: 5, notifiedBm: 2, replied: 1 },
  };
  const sortedCase3 = sortStoresByPriority(storesCase3, countsCase3);
  assert.deepEqual(sortedCase3.map((s) => s.id), ["store-a", "store-z"]);
});

test("filterStoresBySearch filters by store name, account name, and store code while preserving priority sorting", async () => {
  const { filterStoresBySearch } = await import("../src/components/shell/store-search.ts");
  const { sortStoresByPriority } = await import("../src/components/shell/store-priority-sorting.ts");

  const sampleStores = [
    { id: "27626", name: "OBS Asawann Nongkhai By OPPO", code: "27626", accountName: "OPPO ASAWAN NONGKHAI" },
    { id: "28100", name: "OBS Big C Chiangrai By IT CITY", code: "28100", accountName: "OPPO CHIANGRAI" },
    { id: "28200", name: "OBS Big C Kanchanaburi By VTEC", code: "28200", accountName: "OPPO KANCHANABURI" },
  ];

  // Case 1: Search store name ("Chiangrai")
  const resultCase1 = filterStoresBySearch(sampleStores, "Chiangrai");
  assert.equal(resultCase1.length, 1);
  assert.equal(resultCase1[0].name, "OBS Big C Chiangrai By IT CITY");

  // Case 2: Search store code ("27626")
  const resultCase2 = filterStoresBySearch(sampleStores, "27626");
  assert.equal(resultCase2.length, 1);
  assert.equal(resultCase2[0].name, "OBS Asawann Nongkhai By OPPO");

  // Case 3: Case-insensitive ("chiangrai")
  const resultCase3 = filterStoresBySearch(sampleStores, "chiangrai");
  assert.equal(resultCase3.length, 1);
  assert.equal(resultCase3[0].id, "28100");

  // Case 4: No result ("xyz999")
  const resultCase4 = filterStoresBySearch(sampleStores, "xyz999");
  assert.deepEqual(resultCase4, []);

  // Case 5: Priority preserved after search
  const counts = {
    "28100": { notReplied: 10, notifiedBm: 0, replied: 0 },
    "28200": { notReplied: 50, notifiedBm: 0, replied: 0 },
  };
  const filteredBigC = filterStoresBySearch(sampleStores, "Big C");
  const sortedBigC = sortStoresByPriority(filteredBigC, counts);

  assert.equal(sortedBigC.length, 2);
  // Store 28200 (notReplied 50) must appear before 28100 (notReplied 10)
  assert.deepEqual(sortedBigC.map((s) => s.id), ["28200", "28100"]);
});


