import assert from "node:assert/strict";
import test from "node:test";
import { partnerFromStoreName, partnerOf, sortPartnerNames, UNMATCHED_PARTNER } from "../src/lib/v2/partners.ts";

test("the partner is the text after 'By', case-insensitive, with a trailing branch number stripped", () => {
  assert.equal(partnerFromStoreName("OBS Taweekit Buriram By TG 2"), "TG");
  assert.equal(partnerFromStoreName("OBS Taweekit Buriram By TG"), "TG");
  assert.equal(partnerFromStoreName("OBS Central Phitsanulok By OPPO 2"), "OPPO");
  assert.equal(partnerFromStoreName("OBS Robinson Chonburi by oppo"), "OPPO");
  assert.equal(partnerFromStoreName("OBS Central Nakhon Si Thammarat FL.2 By Inter Computer & IT"), "Inter Computer & IT");
  assert.equal(partnerFromStoreName("OBS Stand Alone Narathiwat By S.O.Phone"), "S.O.Phone");
  assert.equal(partnerFromStoreName("OBS X By 8 Global Corporation"), "8 Global Corporation", "a leading digit is part of the name");
});

test("spelling variants are normalized by the explicit map", () => {
  assert.equal(partnerFromStoreName("OBS Big C Chiangrai By IT CITY"), "IT City");
  assert.equal(partnerFromStoreName("OBS A By IT City 3"), "IT City");
  assert.equal(partnerFromStoreName("OBS A By SiamTV"), "Siam TV");
  assert.equal(partnerFromStoreName("OBS A By Siam TV"), "Siam TV");
  assert.equal(partnerFromStoreName("OBS A By  com7 "), "Com7");
});

test("the last 'By' wins and stores without one are unmatched", () => {
  assert.equal(partnerFromStoreName("OBS Stand by Me Plaza By TG"), "TG");
  assert.equal(partnerFromStoreName("OBS Lotus Saraburi"), null);
  assert.equal(partnerFromStoreName("Standby"), null);
  assert.equal(partnerFromStoreName("OBS A By 2"), null, "a bare number is not a partner");
  assert.equal(partnerFromStoreName(""), null);
  assert.equal(partnerOf("xxx"), UNMATCHED_PARTNER);
  assert.equal(partnerOf(null), UNMATCHED_PARTNER);
});

test("partner names sort by name with the unmatched group last", () => {
  assert.deepEqual(sortPartnerNames(["TG", UNMATCHED_PARTNER, "Com7", "OPPO", "TG"]), ["Com7", "OPPO", "TG", UNMATCHED_PARTNER]);
});
