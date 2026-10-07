import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  countThaiWords,
  segmentThaiWords,
  WORD_COUNT_RULE_VERSION,
} from "../src/lib/thai-word-counter.ts";
import {
  extractGoogleReviewCandidates,
  isReviewUiNoise,
} from "../src/lib/google-review-image-text.ts";
import { createReview15Rewrites } from "../next.config.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const example =
  "พนักงาน บริการ ดี มาก แนะนำ OPPO Reno 5G ใช้งาน ง่าย กล้อง สวย ราคา คุ้ม ประทับใจ";

test("canonical counter enforces the 14/15 boundary", () => {
  const fourteen = "a b c d e f g h i j k l m n";
  const fifteen = fourteen + " o";

  assert.equal(countThaiWords(fourteen), 14);
  assert.equal(countThaiWords(fifteen), 15);
  assert.ok(segmentThaiWords(example).count >= 15);
});

test("V4 protects business-approved Thai lexical units before Intl segmentation", () => {
  assert.equal(WORD_COUNT_RULE_VERSION, "THAI_REVIEW_WORDS_V4");

  assert.deepEqual(segmentThaiWords("โปรโมชั่น").finalTokens, ["โปรโมชั่น"]);
  assert.equal(countThaiWords("โปรโมชั่น"), 1);

  assert.deepEqual(segmentThaiWords("สมาร์ทโฟน").finalTokens, ["สมาร์ทโฟน"]);
  assert.equal(countThaiWords("สมาร์ทโฟน"), 1);

  assert.deepEqual(segmentThaiWords("ประทับใจ").finalTokens, ["ประทับใจ"]);
  assert.equal(countThaiWords("ประทับใจ"), 1);

  assert.deepEqual(segmentThaiWords("โปรโมชั่นพิเศษ").finalTokens, ["โปรโมชั่น", "พิเศษ"]);
  assert.equal(countThaiWords("โปรโมชั่นพิเศษ"), 2);
});

test("V3 repairs the exact mixed-script and Thai-boundary failures found in production audit", () => {
  assert.deepEqual(segmentThaiWords("ใช้งาน").finalTokens, ["ใช้งาน"]);
  assert.equal(countThaiWords("ใช้งาน"), 1);

  assert.deepEqual(
    segmentThaiWords("แบตอึดกล้อง").finalTokens,
    ["แบต", "อึด", "กล้อง"],
  );
  assert.equal(countThaiWords("แบตอึดกล้อง"), 3);

  assert.deepEqual(
    segmentThaiWords("ซื้อOPPOReno14Pro5Gวันนี้").finalTokens,
    ["ซื้อ", "OPPO", "Reno14Pro", "5G", "วันนี้"],
  );
  assert.equal(countThaiWords("ซื้อOPPOReno14Pro5Gวันนี้"), 5);

  assert.deepEqual(
    segmentThaiWords("ซื้อOPPOReno14Pro5Gวันนี้ได้ของแถมเยอะมาก").finalTokens,
    ["ซื้อ", "OPPO", "Reno14Pro", "5G", "วันนี้", "ได้", "ของแถม", "เยอะ", "มาก"],
  );

  assert.deepEqual(
    segmentThaiWords("สมาร์ทโฟนเครื่องนี้ใช้งานง่ายแบตอึดกล้องสวยชาร์จเร็ว").finalTokens,
    ["สมาร์ทโฟน", "เครื่อง", "นี้", "ใช้งาน", "ง่าย", "แบต", "อึด", "กล้อง", "สวย", "ชาร์จ", "เร็ว"],
  );
});

test("mixed-script boundaries do not change already-spaced product text", () => {
  assert.deepEqual(
    segmentThaiWords("ซื้อ OPPO Reno14Pro 5G วันนี้").finalTokens,
    ["ซื้อ", "OPPO", "Reno14Pro", "5G", "วันนี้"],
  );
});

test("V4 locks the three compounds found by the second production audit", () => {
  assert.deepEqual(
    segmentThaiWords("พนักงานให้คำแนะนำดีมาก").finalTokens,
    ["พนักงาน", "ให้", "คำแนะนำ", "ดี", "มาก"],
  );
  assert.equal(countThaiWords("คำแนะนำ"), 1);

  assert.deepEqual(
    segmentThaiWords("ของแถมเยอะมาก").finalTokens,
    ["ของแถม", "เยอะ", "มาก"],
  );
  assert.equal(countThaiWords("ของแถม"), 1);

  assert.deepEqual(
    segmentThaiWords("กลับมาใช้บริการอีก").finalTokens,
    ["กลับ", "มา", "ใช้บริการ", "อีก"],
  );
  assert.equal(countThaiWords("ใช้บริการ"), 1);
});

test("V4 reproduces the full second-audit sentence as 38 business words", () => {
  const audited =
    "วันนี้มาซื้อOPPOReno14Pro5Gโปรโมชั่นดีมากพนักงานให้คำแนะนำละเอียดใช้งานง่ายสมาร์ทโฟนเครื่องนี้กล้องสวยแบตอึดชาร์จเร็วของแถมเยอะราคาคุ้มบริการดีมากประทับใจและจะกลับมาใช้บริการอีก";

  assert.deepEqual(segmentThaiWords(audited).finalTokens, [
    "วันนี้",
    "มา",
    "ซื้อ",
    "OPPO",
    "Reno14Pro",
    "5G",
    "โปรโมชั่น",
    "ดี",
    "มาก",
    "พนักงาน",
    "ให้",
    "คำแนะนำ",
    "ละเอียด",
    "ใช้งาน",
    "ง่าย",
    "สมาร์ทโฟน",
    "เครื่อง",
    "นี้",
    "กล้อง",
    "สวย",
    "แบต",
    "อึด",
    "ชาร์จ",
    "เร็ว",
    "ของแถม",
    "เยอะ",
    "ราคา",
    "คุ้ม",
    "บริการ",
    "ดี",
    "มาก",
    "ประทับใจ",
    "และ",
    "จะ",
    "กลับ",
    "มา",
    "ใช้บริการ",
    "อีก",
  ]);
  assert.equal(countThaiWords(audited), 38);
});

test("protected words remain deterministic when repeated or mixed with normal text", () => {
  assert.deepEqual(
    segmentThaiWords("โปรโมชั่น โปรโมชั่นดีมาก").finalTokens,
    ["โปรโมชั่น", "โปรโมชั่น", "ดี", "มาก"],
  );
  assert.equal(countThaiWords("โปรโมชั่น โปรโมชั่นดีมาก"), 4);
});

test("Google Review checker compatibility module re-exports the canonical counter", () => {
  const compatibilityPath = path.join(
    repoRoot,
    "tools/google-review-checker-extension/src/core/thaiWordCounter.ts",
  );
  const compatibilitySource = fs.readFileSync(compatibilityPath, "utf8");

  assert.match(
    compatibilitySource,
    /frontend\/src\/lib\/thai-word-counter\.ts/,
  );
  assert.doesNotMatch(compatibilitySource, /function\s+segmentThaiWords\s*\(/);
});

test("new Thai public URL is primary while the old URL remains compatible", () => {
  assert.deepEqual(createReview15Rewrites(), [
    {
      source: "/%E0%B8%A3%E0%B8%B5%E0%B8%A7%E0%B8%B4%E0%B8%A715%E0%B8%84%E0%B8%B3",
      destination: "/review15",
    },
    {
      source: "/%E0%B8%A3%E0%B8%B5%E0%B8%A7%E0%B8%B4%E0%B8%A715",
      destination: "/review15",
    },
  ]);
});

test("review15 header reuses the public OPPO Brand Shop branding contract", () => {
  const checkerPath = path.join(
    repoRoot,
    "frontend/src/app/review15/review-15-checker.tsx",
  );
  const checkerSource = fs.readFileSync(checkerPath, "utf8");

  assert.match(checkerSource, /import Link from "next\/link";/);
  assert.match(checkerSource, /aria-label="OPPO Brand Shop Home"/);
  assert.match(checkerSource, />\s*OPPO Brand Shop\s*</);
  assert.match(checkerSource, />\s*ค้นหาสาขา & ช่องทางติดต่อ\s*</);
  assert.doesNotMatch(checkerSource, /aria-label="OPPO Home"/);
  assert.doesNotMatch(checkerSource, />\s*oppo\s*</);
});

test("review15 displays a privacy-safe approximate total visitor count", () => {
  const checkerPath = path.join(
    repoRoot,
    "frontend/src/app/review15/review-15-checker.tsx",
  );
  const checkerSource = fs.readFileSync(checkerPath, "utf8");

  assert.match(checkerSource, /lineoppo-review15-visitor-id-v1/);
  assert.match(checkerSource, /window\.localStorage\.getItem/);
  assert.match(checkerSource, /window\.crypto\.randomUUID\(\)/);
  assert.match(checkerSource, /\/api-backend\/review15\/visitors/);
  assert.match(checkerSource, /ผู้เข้าชมรวมโดยประมาณ/);
  assert.match(checkerSource, /ไม่ระบุตัวตน/);
});

test("public review checker uses Google Vision for image scanning", () => {
  const checkerPath = path.join(
    repoRoot,
    "frontend/src/app/review15/review-15-checker.tsx",
  );
  const checkerSource = fs.readFileSync(checkerPath, "utf8");

  assert.match(checkerSource, /segmentThaiWords/);
  assert.match(checkerSource, /สแกนจากภาพ/);
  assert.match(checkerSource, /\/api-backend\/review15\/scan/);
  assert.match(checkerSource, /Google Vision OCR/);
  assert.match(checkerSource, /กฎการนับคำ/);
  assert.match(checkerSource, /ไม่บันทึกไฟล์ภาพลงฐานข้อมูล/);
  assert.doesNotMatch(checkerSource, /tesseract\.js/);
  assert.doesNotMatch(checkerSource, /window\.Tesseract/);
});


test("review15 exposes dedicated social-preview metadata", () => {
  const pagePath = path.join(
    repoRoot,
    "frontend/src/app/review15/page.tsx",
  );
  const pageSource = fs.readFileSync(pagePath, "utf8");

  assert.match(pageSource, /เช็กข้อความรีวิวให้ครบ 15 คำตามกฎ Review KPI/);
  assert.match(pageSource, /https:\/\/lineoppo\.click\/รีวิว15คำ/);
  assert.match(pageSource, /https:\/\/lineoppo\.click\/review15\/opengraph-image\?v=2/);
  assert.match(pageSource, /summary_large_image/);
});

test("review15 has a 1200x630 generated Open Graph image", () => {
  const imagePath = path.join(
    repoRoot,
    "frontend/src/app/review15/opengraph-image.tsx",
  );
  const imageSource = fs.readFileSync(imagePath, "utf8");

  assert.match(imageSource, /ImageResponse/);
  assert.match(imageSource, /width:\s*1200/);
  assert.match(imageSource, /height:\s*630/);
  assert.match(imageSource, /ตรวจสอบรีวิว/);
  assert.match(imageSource, /15/);
  assert.match(imageSource, /Review KPI/);
});


test("Google Review OCR extractor isolates multiple review bodies", () => {
  const ocrText = `
Reviews
OPPO Experience Store Lotus Navanakorn IT City
วิลาวัลย์ เรือนดี
1 review · 1 photo
★★★★★ a month ago
บริการดีมากคับส่วนลดเยอะ ของแถมเยอะ ประทับใจมากคับ
See translation (English)
Press and hold to react
วรรณา ดีสันเทียะ
2 reviews · 1 photo
★★★★★ a month ago
พนักงานให้คำแนะนำดีมาก ของแถมเยอะมาก ใช้บัตรประชาชนใบเดียว
คุยข้อมูลให้ทุกอย่าง
See translation (English)
Press and hold to react
`;

  const candidates = extractGoogleReviewCandidates(ocrText);
  assert.equal(candidates.length, 2);
  assert.equal(
    candidates[0].text,
    "บริการดีมากคับส่วนลดเยอะ ของแถมเยอะ ประทับใจมากคับ",
  );
  assert.equal(
    candidates[1].text,
    "พนักงานให้คำแนะนำดีมาก ของแถมเยอะมาก ใช้บัตรประชาชนใบเดียว คุยข้อมูลให้ทุกอย่าง",
  );
});

test("OCR extraction excludes Google review UI and metadata", () => {
  assert.equal(isReviewUiNoise("See translation (English)"), true);
  assert.equal(isReviewUiNoise("Press and hold to react"), true);
  assert.equal(isReviewUiNoise("★★★★★"), true);
  assert.equal(isReviewUiNoise("1 review"), true);
  assert.equal(isReviewUiNoise("บริการดีมาก"), false);
});


test("image OCR never auto-passes before BM confirms recognized text", () => {
  const checkerPath = path.join(
    repoRoot,
    "frontend/src/app/review15/review-15-checker.tsx",
  );
  const checkerSource = fs.readFileSync(checkerPath, "utf8");

  assert.match(checkerSource, /confirmed:\s*boolean/);
  assert.match(checkerSource, /confirmed:\s*false/);
  assert.match(checkerSource, /ยืนยันข้อความนี้และนับคำ/);
  assert.match(checkerSource, /ระบบจะยังไม่ตัดสินผ่าน 15 คำ/);
  assert.match(checkerSource, /candidate\.confirmed/);
});


test("image scan UI never renders an empty OCR candidate as a review card", () => {
  const checkerPath = path.join(
    repoRoot,
    "frontend/src/app/review15/review-15-checker.tsx",
  );
  const checkerSource = fs.readFileSync(checkerPath, "utf8");

  assert.match(
    checkerSource,
    /payload\.candidates\.filter\([\s\S]*candidate\.text\.trim\(\)\.length > 0/,
  );
  assert.match(checkerSource, /droppedBlankCandidates/);
  assert.match(checkerSource, /setScanMissingReviewCount\(missingReviewCount\)/);
});

test("image scan UI warns when estimated review cards exceed extracted bodies", () => {
  const checkerPath = path.join(
    repoRoot,
    "frontend/src/app/review15/review-15-checker.tsx",
  );
  const checkerSource = fs.readFileSync(checkerPath, "utf8");

  assert.match(checkerSource, /estimatedReviewCount:\s*number/);
  assert.match(checkerSource, /missingReviewCount:\s*number/);
  assert.match(checkerSource, /อาจมีรีวิวตกหล่น/);
  assert.match(checkerSource, /แยกข้อความได้/);
});

test("the 'ใช้ข้อความตัวอย่าง' button uses a defined sample that passes the 15-word rule", async () => {
  // #445 deleted EXAMPLE_TEXT but kept the button, so clicking it threw a ReferenceError.
  const { REVIEW15_EXAMPLE_TEXT } = await import("../src/app/review15/review-15-example.ts");
  assert.equal(REVIEW15_EXAMPLE_TEXT, example);
  assert.ok(countThaiWords(REVIEW15_EXAMPLE_TEXT) >= 15);
  const checker = fs.readFileSync(path.join(repoRoot, "frontend/src/app/review15/review-15-checker.tsx"), "utf8");
  assert.match(checker, /import \{ REVIEW15_EXAMPLE_TEXT \} from "\.\/review-15-example";/);
  assert.match(checker, /onClick=\{\(\) => onTextChange\(REVIEW15_EXAMPLE_TEXT\)\}[\s\S]{0,300}ใช้ข้อความตัวอย่าง/);
  // Every identifier the button path uses must be defined: no bare EXAMPLE_TEXT left.
  assert.doesNotMatch(checker, /(?<![\w_])EXAMPLE_TEXT(?![\w_])/);
});
