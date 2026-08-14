import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const heroCode = readFileSync(new URL("../src/app/dashboard/executive-hero.tsx", import.meta.url), "utf8");
const followerGrowthCode = readFileSync(new URL("../src/app/dashboard/follower-growth.tsx", import.meta.url), "utf8");
const transformersCode = readFileSync(new URL("../src/app/dashboard/dashboard-transformers.ts", import.meta.url), "utf8");

test("ExecutiveHero does NOT display misleading 'Retained' or 'Retention' badge", () => {
  assert.doesNotMatch(heroCode, /% Retained/);
  assert.doesNotMatch(heroCode, /Retention Rate/i);
  assert.doesNotMatch(heroCode, /รักษาฐานผู้ติดตาม/);
  assert.doesNotMatch(heroCode, /อัตรารักษาผู้ติดตาม/);
});

test("FollowerGrowthCard provides accurate period labels for Today, 7d, and 30d", () => {
  // Thai
  assert.match(followerGrowthCode, /addedToday:\s*"ผู้ติดตามใหม่"/);
  assert.match(followerGrowthCode, /blockedToday:\s*"Block เพิ่ม"/);
  assert.match(followerGrowthCode, /netGrowth:\s*"เพิ่มขึ้นสุทธิ"/);
  assert.match(followerGrowthCode, /added7d:\s*"ผู้ติดตามใหม่ใน 7 วัน"/);
  assert.match(followerGrowthCode, /blocked7d:\s*"Block เพิ่มใน 7 วัน"/);
  assert.match(followerGrowthCode, /net7d:\s*"เพิ่มขึ้นสุทธิใน 7 วัน"/);
  assert.match(followerGrowthCode, /added30d:\s*"ผู้ติดตามใหม่ใน 30 วัน"/);
  assert.match(followerGrowthCode, /blocked30d:\s*"Block เพิ่มใน 30 วัน"/);
  assert.match(followerGrowthCode, /net30d:\s*"เพิ่มขึ้นสุทธิใน 30 วัน"/);

  // English
  assert.match(followerGrowthCode, /addedToday:\s*"New Followers"/);
  assert.match(followerGrowthCode, /blockedToday:\s*"New Blocks"/);
  assert.match(followerGrowthCode, /netGrowth:\s*"Net Growth"/);

  // Chinese
  assert.match(followerGrowthCode, /addedToday:\s*"新增粉丝"/);
  assert.match(followerGrowthCode, /blockedToday:\s*"新增封禁"/);
  assert.match(followerGrowthCode, /netGrowth:\s*"净增长"/);
});

test("FollowerGrowthCard formats signs truthfully for positive and negative values", () => {
  // Block delta sign is not unconditionally prepended with '-'
  assert.match(followerGrowthCode, /blockedVal > 0 \? blockedVal\.toLocaleString\(\) : blockedVal === 0 \? "0" : blockedVal\.toLocaleString\(\)/);
  // Added followers displays + when positive
  assert.match(followerGrowthCode, /addedVal >= 0 \? `\+\$\{addedVal\.toLocaleString\(\)\}` : addedVal\.toLocaleString\(\)/);
  // Net growth displays + when positive
  assert.match(followerGrowthCode, /netVal >= 0 \? `\+\$\{netVal\.toLocaleString\(\)\}` : netVal\.toLocaleString\(\)/);
});

test("ExecutiveHero follower acquisition breakdown is clearly labeled New Followers vs New Blocks", () => {
  assert.match(heroCode, /followerAcquisition:\s*"สัดส่วนผู้ติดตามใหม่และบล็อก"/);
  assert.match(heroCode, /followerAcquisition:\s*"Follower Acquisition & Block Distribution"/);
  assert.match(heroCode, /followerAcquisition:\s*"新增与封禁分布"/);
  // Percentage is hidden or shows '-' when gross added total is 0
  assert.match(heroCode, /addedFollowers > 0 \? "100%" : "-"/);
  assert.match(heroCode, /grossAddedTotal > 0 \? `\$\{Math\.round\(\(Math\.max\(0, blockedFollowers\) \/ grossAddedTotal\) \* 100\)\}%` : "-"/);
});

test("Dashboard summary cards transformer formats follower subtext truthfully", () => {
  assert.match(transformersCode, /ผู้ติดตามใหม่: \$\{followerGrowth\?\.addedToday != null && followerGrowth\.addedToday >= 0 \? `\+\$\{followerGrowth\.addedToday\}` : followerGrowth\?\.addedToday \?\? 0\}/);
});
