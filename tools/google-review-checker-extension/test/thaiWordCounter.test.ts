import test from "node:test";
import assert from "node:assert/strict";
import {
  countThaiWords,
  segmentThaiWords,
  mergeThaiCompoundPrefixes,
  applyCompoundDictionary,
  isMeaningfulToken,
} from "../src/core/thaiWordCounter.ts";

test("countThaiWords handles empty, null, and whitespace text safely", () => {
  assert.equal(countThaiWords(""), 0);
  assert.equal(countThaiWords("   "), 0);
  assert.equal(countThaiWords(null), 0);
  assert.equal(countThaiWords(undefined), 0);
});

test("Prefix merge: merges specified compound prefixes with subsequent word", () => {
  // การ + บริการ → 1 word
  assert.deepEqual(segmentThaiWords("การบริการ").finalTokens, ["การบริการ"]);
  assert.equal(countThaiWords("การบริการ"), 1);

  // ความ + สวย → 1 word
  assert.deepEqual(segmentThaiWords("ความสวย").finalTokens, ["ความสวย"]);
  assert.equal(countThaiWords("ความสวย"), 1);

  // น่า + รัก → 1 word
  assert.deepEqual(segmentThaiWords("น่ารัก").finalTokens, ["น่ารัก"]);
  assert.equal(countThaiWords("น่ารัก"), 1);

  // ผู้ + ขาย → 1 word
  assert.deepEqual(segmentThaiWords("ผู้ขาย").finalTokens, ["ผู้ขาย"]);
  assert.equal(countThaiWords("ผู้ขาย"), 1);

  // นัก + ท่องเที่ยว → 1 word
  assert.deepEqual(segmentThaiWords("นักท่องเที่ยว").finalTokens, ["นักท่องเที่ยว"]);
  assert.equal(countThaiWords("นักท่องเที่ยว"), 1);

  // ชาว + ไทย → 1 word
  assert.deepEqual(segmentThaiWords("ชาวไทย").finalTokens, ["ชาวไทย"]);
  assert.equal(countThaiWords("ชาวไทย"), 1);

  // ช่าง + ซ่อม → 1 word
  assert.deepEqual(segmentThaiWords("ช่างซ่อม").finalTokens, ["ช่างซ่อม"]);
  assert.equal(countThaiWords("ช่างซ่อม"), 1);
});

test("Non-merge: does NOT merge normal phrases", () => {
  // ไม่ + ดี → 2 words
  assert.deepEqual(segmentThaiWords("ไม่ดี").finalTokens, ["ไม่", "ดี"]);
  assert.equal(countThaiWords("ไม่ดี"), 2);

  // ดี + มาก → 2 words
  assert.deepEqual(segmentThaiWords("ดีมาก").finalTokens, ["ดี", "มาก"]);
  assert.equal(countThaiWords("ดีมาก"), 2);

  // บริการ + ดี → 2 words
  assert.deepEqual(segmentThaiWords("บริการดี").finalTokens, ["บริการ", "ดี"]);
  assert.equal(countThaiWords("บริการดี"), 2);

  // พนักงาน + ดี → 2 words
  assert.deepEqual(segmentThaiWords("พนักงานดี").finalTokens, ["พนักงาน", "ดี"]);
  assert.equal(countThaiWords("พนักงานดี"), 2);

  // ร้าน + สวย → 2 words
  assert.deepEqual(segmentThaiWords("ร้านสวย").finalTokens, ["ร้าน", "สวย"]);
  assert.equal(countThaiWords("ร้านสวย"), 2);
});

test("Compound dictionary: merges explicit compound words without wildcard merging", () => {
  // โรงพยาบาล → 1 word
  assert.deepEqual(segmentThaiWords("โรงพยาบาล").finalTokens, ["โรงพยาบาล"]);
  assert.equal(countThaiWords("โรงพยาบาล"), 1);

  // เครื่องใช้ → 1 word
  assert.deepEqual(segmentThaiWords("เครื่องใช้").finalTokens, ["เครื่องใช้"]);
  assert.equal(countThaiWords("เครื่องใช้"), 1);

  // แม่บ้าน → 1 word
  assert.deepEqual(segmentThaiWords("แม่บ้าน").finalTokens, ["แม่บ้าน"]);
  assert.equal(countThaiWords("แม่บ้าน"), 1);

  // Non-matching prefix: โรง + อาหาร remains 2 words
  assert.deepEqual(segmentThaiWords("โรงอาหาร").finalTokens, ["โรง", "อาหาร"]);
  assert.equal(countThaiWords("โรงอาหาร"), 2);
});

test("Repeated words: counts every repetition without deduplication", () => {
  // "ดี มาก ดี มาก" → 4 words
  const res = segmentThaiWords("ดี มาก ดี มาก");
  assert.deepEqual(res.finalTokens, ["ดี", "มาก", "ดี", "มาก"]);
  assert.equal(res.count, 4);
});

test("Noise exclusion: ignores emoji, punctuation, pure numbers, and Google Maps UI strings", () => {
  const noiseText = "👍 2026 500 !! ??? *** See translation อ่านเพิ่มเติม More Like Share";
  assert.equal(countThaiWords(noiseText), 0);

  // Meaningful letters mixed with numbers and punctuation:
  // "OPPO Reno 12 5G ดีมาก"
  // "OPPO", "Reno", "12" is pure number (excluded), "5G" (has letter, kept), "ดี", "มาก"
  const mixed = segmentThaiWords("OPPO Reno 12 5G ดีมาก");
  assert.ok(mixed.finalTokens.includes("OPPO"));
  assert.ok(mixed.finalTokens.includes("Reno"));
  assert.ok(!mixed.finalTokens.includes("12")); // pure number excluded
  assert.ok(mixed.finalTokens.includes("5G"));
  assert.ok(mixed.finalTokens.includes("ดี"));
  assert.ok(mixed.finalTokens.includes("มาก"));
});

test("Real Thai Review Regression Fixture: does NOT return 2 words", () => {
  const realText = "มาร่วมกิจกรรม พนักงานพูดจาดีน่ารักมาก แนะนำดีตลอดการร่วมกิจกรรม";
  const res = segmentThaiWords(realText);

  // Must NOT incorrectly return 2 words
  assert.notEqual(res.count, 2, "Must not return only 2 words");

  // Verify raw tokens: 15 tokens
  assert.deepEqual(res.rawTokens, [
    "มา", "ร่วม", "กิจกรรม", "พนักงาน", "พูดจา", "ดี", "น่า", "รัก", "มาก", "แนะนำ", "ดี", "ตลอด", "การ", "ร่วม", "กิจกรรม"
  ]);

  // Verify final tokens: 13 tokens (น่า+รัก -> น่ารัก, การ+ร่วม -> การร่วม)
  assert.deepEqual(res.finalTokens, [
    "มา", "ร่วม", "กิจกรรม", "พนักงาน", "พูดจา", "ดี", "น่ารัก", "มาก", "แนะนำ", "ดี", "ตลอด", "การร่วม", "กิจกรรม"
  ]);

  assert.equal(res.count, 13);
});

test("Threshold counting: 14 words vs 15 words vs 16 words", () => {
  // 14 distinct words:
  const text14 = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย";
  assert.equal(countThaiWords(text14), 14);

  // 15 distinct words:
  const text15 = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย ปู";
  assert.equal(countThaiWords(text15), 15);

  // 16 distinct words:
  const text16 = "กบ มด นก กา ไก่ เป็ด หมู หมา ม้า วัว เสือ ปลา กุ้ง หอย ปู ช้าง";
  assert.equal(countThaiWords(text16), 16);
});

test("Thai repetition mark ๆ and punctuation ฯ do NOT count as words", () => {
  // 1. เยอะ ๆ → 1 counted word
  const res1 = segmentThaiWords("เยอะ ๆ");
  assert.deepEqual(res1.finalTokens, ["เยอะ"]);
  assert.equal(res1.count, 1);

  // 2. ดีมาก ๆ → no extra word from ๆ (2 counted words)
  const res2 = segmentThaiWords("ดีมาก ๆ");
  assert.deepEqual(res2.finalTokens, ["ดี", "มาก"]);
  assert.equal(res2.count, 2);

  // Attached repetition: เยอะๆ → 1 counted word
  const resAttached = segmentThaiWords("เยอะๆ");
  assert.deepEqual(resAttached.finalTokens, ["เยอะ"]);
  assert.equal(resAttached.count, 1);

  // 3. standalone ๆ → 0
  assert.equal(countThaiWords("ๆ"), 0);
  assert.equal(countThaiWords("ๆ ๆ ๆ"), 0);

  // 4. standalone ฯ → 0
  assert.equal(countThaiWords("ฯ"), 0);
  assert.equal(countThaiWords("ฯลฯ"), 0);

  // 5. Minions regression: "ร้านดูแลดีมาก ชอบมาก มาร่วมกิจกรรมกันเยอะ ๆ"
  // [ร้าน, ดูแล, ดี, มาก, ชอบ, มาก, มา, ร่วม, กิจกรรม, กัน, เยอะ] = 11 words (not 12)
  const minionsRes = segmentThaiWords("ร้านดูแลดีมาก ชอบมาก มาร่วมกิจกรรมกันเยอะ ๆ");
  assert.deepEqual(minionsRes.finalTokens, [
    "ร้าน", "ดูแล", "ดี", "มาก", "ชอบ", "มาก", "มา", "ร่วม", "กิจกรรม", "กัน", "เยอะ"
  ]);
  assert.equal(minionsRes.count, 11);
});
