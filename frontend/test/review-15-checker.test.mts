import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countThaiWords, segmentThaiWords } from "../src/lib/thai-word-counter.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");

const example =
  "พนักงาน บริการ ดี มาก แนะนำ OPPO Reno 5G ใช้งาน ง่าย กล้อง สวย ราคา คุ้ม ประทับใจ";

test("public review checker uses canonical 15-word counting rules", () => {
  const result = segmentThaiWords(example);
  assert.equal(result.count, 15);
  assert.equal(countThaiWords(example), 15);
  assert.deepEqual(result.finalTokens, [
    "พนักงาน",
    "บริการ",
    "ดี",
    "มาก",
    "แนะนำ",
    "OPPO",
    "Reno",
    "5G",
    "ใช้งาน",
    "ง่าย",
    "กล้อง",
    "สวย",
    "ราคา",
    "คุ้ม",
    "ประทับใจ",
  ]);
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

test("/รีวิว15 is a public client-only checker and does not call an API", () => {
  const checkerPath = path.join(
    repoRoot,
    "frontend/src/app/รีวิว15/review-15-checker.tsx",
  );
  const checkerSource = fs.readFileSync(checkerPath, "utf8");

  assert.match(checkerSource, /segmentThaiWords/);
  assert.match(checkerSource, /ข้อความไม่ถูกบันทึกหรือส่งออกจากอุปกรณ์/);
  assert.doesNotMatch(checkerSource, /fetch\s*\(/);
});
