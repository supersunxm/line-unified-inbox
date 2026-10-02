import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { countThaiWords, segmentThaiWords } from "../src/lib/thai-word-counter.ts";
import { createReview15Rewrite } from "../next.config.ts";

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

test("/รีวิว15 rewrites to a stable public route", () => {
  assert.deepEqual(createReview15Rewrite(), {
    source: "/รีวิว15",
    destination: "/review15",
  });
});

test("public review checker is client-only and does not call an API", () => {
  const checkerPath = path.join(
    repoRoot,
    "frontend/src/app/review15/review-15-checker.tsx",
  );
  const checkerSource = fs.readFileSync(checkerPath, "utf8");

  assert.match(checkerSource, /segmentThaiWords/);
  assert.match(checkerSource, /ข้อความไม่ถูกบันทึกหรือส่งออกจากอุปกรณ์/);
  assert.doesNotMatch(checkerSource, /fetch\s*\(/);
});
