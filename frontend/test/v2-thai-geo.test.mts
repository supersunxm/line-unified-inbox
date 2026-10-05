import assert from "node:assert/strict";
import test from "node:test";
import { THAI_PROVINCES, thaiLocationLabel, thaiProvince, thaiRegion } from "../src/lib/v2/thai-geo.ts";

test("regions map to Thai", () => {
  const expected: Array<[string, string]> = [
    ["Bangkok", "กรุงเทพฯ"], ["Central", "ภาคกลาง"], ["Eastern", "ภาคตะวันออก"], ["Western", "ภาคตะวันตก"],
    ["Northern", "ภาคเหนือ"], ["Northeastern", "ภาคอีสาน"], ["Southern", "ภาคใต้"],
  ];
  for (const [english, thai] of expected) assert.equal(thaiRegion(english), thai, english);
  assert.equal(thaiRegion("  eastern "), "ภาคตะวันออก");
  assert.equal(thaiRegion("North Eastern"), "ภาคอีสาน");
});

test("all 77 provinces map to Thai, with spacing variants", () => {
  assert.equal(THAI_PROVINCES.length, 77);
  assert.equal(new Set(THAI_PROVINCES.map(([thai]) => thai)).size, 77);
  assert.equal(thaiProvince("Chonburi"), "ชลบุรี");
  assert.equal(thaiProvince("Chon Buri"), "ชลบุรี");
  assert.equal(thaiProvince("Bangkok"), "กรุงเทพมหานคร");
  assert.equal(thaiProvince("Nakhon Ratchasima"), "นครราชสีมา");
  assert.equal(thaiProvince("Phra Nakhon Si Ayutthaya"), "พระนครศรีอยุธยา");
  assert.equal(thaiProvince("Nong Bua Lam Phu"), "หนองบัวลำภู");
  assert.equal(thaiProvince("Si Sa Ket"), "ศรีสะเกษ");
  // Every English spelling resolves to its own Thai name.
  for (const [thai, english] of THAI_PROVINCES) for (const name of english) assert.equal(thaiProvince(name), thai, name);
});

test("unknown values pass through unchanged; empty values give nothing", () => {
  assert.equal(thaiRegion("Metro Zone 3"), "Metro Zone 3");
  assert.equal(thaiProvince("Atlantis"), "Atlantis");
  assert.equal(thaiProvince("ชลบุรี"), "ชลบุรี"); // already Thai
  assert.equal(thaiRegion(""), null);
  assert.equal(thaiProvince(null), null);
});

test("the location label is Thai, shows Bangkok once, and is hidden when empty", () => {
  assert.equal(thaiLocationLabel("Eastern", "Chonburi"), "ภาคตะวันออก · ชลบุรี");
  assert.equal(thaiLocationLabel("Bangkok", "Bangkok"), "กรุงเทพฯ");
  assert.equal(thaiLocationLabel(null, "Chonburi"), "ชลบุรี");
  assert.equal(thaiLocationLabel("Eastern", "Atlantis"), "ภาคตะวันออก · Atlantis");
  assert.equal(thaiLocationLabel(null, null), null);
});
