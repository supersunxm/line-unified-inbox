import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countThaiWords, segmentThaiWords } from "../src/lib/thai-word-counter.ts";
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
