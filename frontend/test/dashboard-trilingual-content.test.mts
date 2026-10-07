import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboardPage = readFileSync(new URL("../src/app/dashboard/page.tsx", import.meta.url), "utf8");
const dashboardI18n = readFileSync(new URL("../src/app/dashboard/dashboard-legacy-i18n.ts", import.meta.url), "utf8");

test("dashboard route applies the shared trilingual boundary", () => {
  assert.match(dashboardPage, /LegacyI18nBoundary/);
  assert.match(dashboardPage, /dashboardLegacyPhrases/);
  assert.match(dashboardPage, /dashboardLegacyTemplates/);
  assert.match(dashboardPage, /showControl=\{false\}/);
});

test("executive dashboard translations cover visible Thai, English, and Chinese content", () => {
  assert.match(dashboardI18n, /ภาพรวมผู้บริหาร/);
  assert.match(dashboardI18n, /Executive Overview/);
  assert.match(dashboardI18n, /管理总览/);
  assert.match(dashboardI18n, /การตอบกลับลูกค้า/);
  assert.match(dashboardI18n, /Customer replies/);
  assert.match(dashboardI18n, /客户回复/);
  assert.match(dashboardI18n, /รายละเอียดระดับสาขา/);
  assert.match(dashboardI18n, /Store-level details/);
  assert.match(dashboardI18n, /门店级详情/);
});

test("dashboard translations cover dynamic durations and Thai month labels", () => {
  assert.match(dashboardI18n, /\{\{value\}\} นาที/);
  assert.match(dashboardI18n, /\{\{value\}\} ชม\./);
  assert.match(dashboardI18n, /8月\{\{value\}\}日/);
  assert.match(dashboardI18n, /Aug \{\{value\}\}/);
});

test("response analytics labels are translated for Thai", () => {
  assert.match(dashboardI18n, /p\("การวิเคราะห์ผู้ตอบกลับ", "Responder analytics", "回复者分析"\)/);
  assert.match(dashboardI18n, /p\("บัญชีพนักงานปัจจุบัน", "Current staff account", "当前员工账号"\)/);
  assert.match(dashboardI18n, /p\("ไม่มีข้อมูลระบุตัวผู้ตอบกลับในช่วงเวลานี้"/);
});
