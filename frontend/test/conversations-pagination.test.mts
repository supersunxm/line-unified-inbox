import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  calculatePaginationBounds,
  chatsPaginationTranslations,
  getChatsPaginationText,
  getPageNumbers,
} from "../src/app/chats-pagination-utils.ts";

test("0 conversations boundary calculations", () => {
  const bounds = calculatePaginationBounds(0, 1, 20);
  assert.equal(bounds.safePage, 1);
  assert.equal(bounds.totalPages, 1);
  assert.equal(bounds.startRecord, 0);
  assert.equal(bounds.endRecord, 0);
});

test("1 conversation boundary calculations", () => {
  const bounds = calculatePaginationBounds(1, 1, 20);
  assert.equal(bounds.safePage, 1);
  assert.equal(bounds.totalPages, 1);
  assert.equal(bounds.startRecord, 1);
  assert.equal(bounds.endRecord, 1);
});

test("exactly 10 conversations boundary calculations", () => {
  const bounds10 = calculatePaginationBounds(10, 1, 10);
  assert.equal(bounds10.safePage, 1);
  assert.equal(bounds10.totalPages, 1);
  assert.equal(bounds10.startRecord, 1);
  assert.equal(bounds10.endRecord, 10);

  const bounds20 = calculatePaginationBounds(10, 1, 20);
  assert.equal(bounds20.safePage, 1);
  assert.equal(bounds20.totalPages, 1);
  assert.equal(bounds20.startRecord, 1);
  assert.equal(bounds20.endRecord, 10);
});

test("exactly 20 conversations boundary calculations", () => {
  const bounds = calculatePaginationBounds(20, 1, 20);
  assert.equal(bounds.safePage, 1);
  assert.equal(bounds.totalPages, 1);
  assert.equal(bounds.startRecord, 1);
  assert.equal(bounds.endRecord, 20);
});

test("21 conversations boundary calculations across multiple pages", () => {
  const page1 = calculatePaginationBounds(21, 1, 20);
  assert.equal(page1.safePage, 1);
  assert.equal(page1.totalPages, 2);
  assert.equal(page1.startRecord, 1);
  assert.equal(page1.endRecord, 20);

  const page2 = calculatePaginationBounds(21, 2, 20);
  assert.equal(page2.safePage, 2);
  assert.equal(page2.totalPages, 2);
  assert.equal(page2.startRecord, 21);
  assert.equal(page2.endRecord, 21);
});

test("145 conversations boundary calculations and page number sequences", () => {
  const p1 = calculatePaginationBounds(145, 1, 20);
  assert.equal(p1.safePage, 1);
  assert.equal(p1.totalPages, 8);
  assert.equal(p1.startRecord, 1);
  assert.equal(p1.endRecord, 20);

  const p8 = calculatePaginationBounds(145, 8, 20);
  assert.equal(p8.safePage, 8);
  assert.equal(p8.totalPages, 8);
  assert.equal(p8.startRecord, 141);
  assert.equal(p8.endRecord, 145);

  const pClamp = calculatePaginationBounds(145, 99, 20);
  assert.equal(pClamp.safePage, 8);
  assert.equal(pClamp.startRecord, 141);
  assert.equal(pClamp.endRecord, 145);
});

test("changing page size from 20 to 10 recalculates pages without off-by-one errors", () => {
  const size20 = calculatePaginationBounds(145, 1, 20);
  assert.equal(size20.totalPages, 8);

  const size10 = calculatePaginationBounds(145, 1, 10);
  assert.equal(size10.totalPages, 15);
  assert.equal(size10.startRecord, 1);
  assert.equal(size10.endRecord, 10);
});

test("getPageNumbers helper produces correct page button lists", () => {
  assert.deepEqual(getPageNumbers(1, 1), [1]);
  assert.deepEqual(getPageNumbers(1, 3), [1, 2, 3]);
  assert.deepEqual(getPageNumbers(1, 8), [1, 2, 3, 4, 5]);
  assert.deepEqual(getPageNumbers(5, 8), [3, 4, 5, 6, 7]);
  assert.deepEqual(getPageNumbers(8, 8), [4, 5, 6, 7, 8]);
});

test("Thai, English, and Chinese pagination labels match exact prompt requirements", () => {
  const th = getChatsPaginationText("th");
  const en = getChatsPaginationText("en");
  const zh = getChatsPaginationText("zh");

  // Thai labels
  assert.equal(th.showingRangeText(1, 20, 145), "แสดง 1–20 จากทั้งหมด 145 แชท");
  assert.equal(th.previous, "ก่อนหน้า");
  assert.equal(th.next, "ถัดไป");
  assert.equal(th.itemsPerPage, "รายการต่อหน้า");
  assert.equal(th.pageOfTotal(1, 8), "หน้า 1 จาก 8");
  assert.equal(th.newChatsAvailable, "มีแชทใหม่");
  assert.equal(th.refreshPage1, "กลับไปหน้า 1");

  // English labels
  assert.equal(en.showingRangeText(1, 20, 145), "Showing 1–20 of 145 chats");
  assert.equal(en.previous, "Previous");
  assert.equal(en.next, "Next");
  assert.equal(en.itemsPerPage, "Items per page");
  assert.equal(en.pageOfTotal(1, 8), "Page 1 of 8");
  assert.equal(en.newChatsAvailable, "New chats available");
  assert.equal(en.refreshPage1, "Go to page 1");

  // Chinese labels
  assert.equal(zh.showingRangeText(1, 20, 145), "显示第 1–20 条，共 145 个会话");
  assert.equal(zh.previous, "上一页");
  assert.equal(zh.next, "下一页");
  assert.equal(zh.itemsPerPage, "每页数量");
  assert.equal(zh.pageOfTotal(1, 8), "第 1 页，共 8 页");
  assert.equal(zh.newChatsAvailable, "有新会话");
  assert.equal(zh.refreshPage1, "返回第 1 页");
});

test("Every locale (en, th, zh) exposes identical pagination translation key sets", () => {
  const enKeys = Object.keys(chatsPaginationTranslations.en).sort();
  const thKeys = Object.keys(chatsPaginationTranslations.th).sort();
  const zhKeys = Object.keys(chatsPaginationTranslations.zh).sort();

  assert.deepEqual(thKeys, enKeys, "Thai pagination keys must match English keys");
  assert.deepEqual(zhKeys, enKeys, "Chinese pagination keys must match English keys");
});

test("Pagination architecture in page.tsx enforces layout height lock, filter reset to page 1, and accessible footer", () => {
  const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  const footerCode = readFileSync(new URL("../src/app/conversation-pagination-footer.tsx", import.meta.url), "utf8");
  const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");

  // Viewport height constraint
  assert.match(pageCode, /className=\{`app-workspace-grid grid h-full max-h-full overflow-hidden/);

  // Filter auto-reset tracking
  assert.match(pageCode, /targetPage = filtersChanged \? 1 : chatPage/);

  // API conversations method supports query parameters
  assert.match(apiCode, /conversations: \(params\?: Record<string, string \| number \| boolean \| undefined>\) =>/);

  // Pagination Footer Accessibility
  assert.match(footerCode, /aria-label=\{t\.itemsPerPage\}/);
  assert.match(footerCode, /aria-label=\{t\.previous\}/);
  assert.match(footerCode, /aria-label=\{t\.next\}/);
  assert.match(footerCode, /aria-current=\{isActive \? "page" : undefined\}/);
});
