import assert from "node:assert/strict";
import test from "node:test";
import { AMBIGUOUS_PARTNER_PAIRS, normalizePartnerInput, partnerFromStoreName } from "./partner-parse";

void test("seed parse: last 'By', branch number stripped, variants merged by the explicit map", () => {
  assert.equal(partnerFromStoreName("OBS Taweekit Buriram By TG 2"), "TG");
  assert.equal(partnerFromStoreName("OBS Central Phitsanulok By OPPO 2"), "OPPO");
  assert.equal(partnerFromStoreName("OBS Big C Chiangrai By IT CITY"), "IT City");
  assert.equal(partnerFromStoreName("OBS A By SiamTV"), "Siam TV");
  assert.equal(partnerFromStoreName("OBS Stand by Me By TG"), "TG");
  assert.equal(partnerFromStoreName("OBS X By 8 Global Corporation"), "8 Global Corporation");
  assert.equal(partnerFromStoreName("OBS Lotus Saraburi"), null);
  assert.equal(partnerFromStoreName("OBS A By 2"), null);
});

void test("ambiguous pairs stay separate partners", () => {
  for (const [left, right] of AMBIGUOUS_PARTNER_PAIRS) {
    assert.notEqual(partnerFromStoreName(`OBS A By ${left}`), partnerFromStoreName(`OBS B By ${right}`));
  }
  assert.equal(partnerFromStoreName("OBS Big C Mahachai By JP"), "JP");
  assert.equal(partnerFromStoreName("OBS A By JP Store"), "JP Store");
  assert.equal(partnerFromStoreName("OBS A By INTERCOM"), "INTERCOM");
  assert.equal(partnerFromStoreName("OBS A FL.2 By Inter Computer & IT"), "Inter Computer & IT");
});

void test("admin input is trimmed; empty clears; too long is refused", () => {
  assert.equal(normalizePartnerInput("  Siam   TV "), "Siam TV");
  assert.equal(normalizePartnerInput(""), null);
  assert.equal(normalizePartnerInput(null), null);
  assert.throws(() => normalizePartnerInput("x".repeat(101)), /PARTNER_NAME_TOO_LONG/);
});
