import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const integrationPageSource = readFileSync(
  new URL("../src/app/tiktok-integration/page.tsx", import.meta.url),
  "utf8"
);
const landingPageSource = readFileSync(
  new URL("../src/app/public-landing-page.tsx", import.meta.url),
  "utf8"
);
const storesDirectorySource = readFileSync(
  new URL("../src/app/stores/public-stores-directory.tsx", import.meta.url),
  "utf8"
);
const storeProfileSource = readFileSync(
  new URL("../src/app/stores/[identifier]/public-store-profile.tsx", import.meta.url),
  "utf8"
);

test("TikTok Integration explanation page exists and has descriptive SEO metadata", () => {
  assert.ok(existsSync(new URL("../src/app/tiktok-integration/page.tsx", import.meta.url)));
  assert.match(integrationPageSource, /absolute:\s*"การเชื่อมต่อ TikTok \| OPPO Brand Shop"/);
  assert.match(integrationPageSource, /รายละเอียดการเชื่อมต่ออย่างเป็นทางการระหว่าง TikTok Login Kit กับระบบ OPPO Brand Shop/);
});

test("TikTok Integration page states exact required Thai explanation of what the integration does", () => {
  assert.match(
    integrationPageSource,
    /เจ้าของบัญชี TikTok ของ OPPO Brand Shop สามารถเชื่อมต่อบัญชีเพื่อแสดงข้อมูลโปรไฟล์และสถิติพื้นฐานของบัญชีบนแพลตฟอร์ม/
  );
  assert.match(integrationPageSource, /TikTok Login Kit \(Web OAuth 2\.0\)/);
});

test("TikTok Integration page lists all 6 categories of data accessed", () => {
  assert.match(integrationPageSource, /user\.info\.basic/);
  assert.match(integrationPageSource, /user\.info\.profile/);
  assert.match(integrationPageSource, /user\.info\.stats/);
  assert.match(integrationPageSource, /รูปโปรไฟล์ \(Avatar\)/);
  assert.match(integrationPageSource, /ชื่อที่แสดง \(Display Name\)/);
  assert.match(integrationPageSource, /ชื่อผู้ใช้ \(@username\)/);
  assert.match(integrationPageSource, /จำนวนผู้ติดตาม \(Follower Count\)/);
  assert.match(integrationPageSource, /กำลังติดตาม \(Following Count\)/);
  assert.match(integrationPageSource, /ยอดถูกใจทั้งหมด \(Likes Count\)/);
  assert.match(integrationPageSource, /จำนวนวิดีโอ \(Video Count\)/);
});

test("TikTok Integration page explains dual business purpose: store directory presence and internal analytics", () => {
  assert.match(integrationPageSource, /แสดงช่องทางโซเชียลมีเดียที่ถูกต้องของสาขา/);
  assert.match(integrationPageSource, /วิเคราะห์และติดตามตัวชี้วัดของสาขา/);
  assert.match(integrationPageSource, /Store Directory/);
});

test("TikTok Integration page explicitly enforces strict boundaries (no posting, no modifying, no DMs)", () => {
  assert.match(integrationPageSource, /ไม่โพสต์คอนเทนต์บน TikTok/);
  assert.match(integrationPageSource, /ไม่แก้ไขหรือลบคอนเทนต์/);
  assert.match(integrationPageSource, /ไม่เข้าถึงข้อความส่วนตัว/);
  assert.match(integrationPageSource, /ไม่เข้าถึงบัญชีโดยไม่ได้รับอนุญาต/);
});

test("TikTok Integration page details security, AES-256 encryption, and revocation workflow", () => {
  assert.match(integrationPageSource, /AES-256-GCM/);
  assert.match(integrationPageSource, /การเพิกถอนสิทธิ์/);
  assert.match(integrationPageSource, /obsthailand@gmail\.com/);
});

test("TikTok Integration page links to Privacy Policy, Terms of Service, and Connect flow", () => {
  assert.match(integrationPageSource, /href="\/privacy"/);
  assert.match(integrationPageSource, /href="\/terms"/);
  assert.match(integrationPageSource, /href="\/connect\/tiktok"/);
  assert.match(integrationPageSource, /href="\/stores"/);
});

test("Public footers link to /tiktok-integration", () => {
  assert.match(landingPageSource, /href="\/tiktok-integration"/);
  assert.match(storesDirectorySource, /href="\/tiktok-integration"/);
  assert.match(storeProfileSource, /href="\/tiktok-integration"/);
});

test("Security: No secrets or sensitive tokens in tiktok-integration page", () => {
  assert.doesNotMatch(integrationPageSource, /TIKTOK_CLIENT_SECRET/);
  assert.doesNotMatch(integrationPageSource, /access_token/);
  assert.doesNotMatch(integrationPageSource, /refresh_token/);
});
