import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chooseKeywordRule, keywordPatternsOverlap, matchKeyword, parseKeywordConfig, targetsLineOa } from "./auto-response-keyword";

const oa = "11111111-1111-1111-1111-111111111111";
const config = (overrides: Record<string, unknown> = {}) => parseKeywordConfig({
  matcherVersion: 1, matchMode: "CONTAINS", keywords: ["Find X10"],
  priority: 10, targetMode: "SELECTED", targetLineOaIds: [oa],
  excludedLineOaIds: [], ...overrides,
})!;

describe("Keyword Auto Response", () => {
  it("normalizes Thai + English and white space", () => assert.equal(matchKeyword("สนใจ   FIND   X10 ครับ", config()).matched, true));
  it("matches Thai keywords in continuous Thai text", () => {
    assert.equal(matchKeyword("สนใจซื้อสินค้า", config({keywords:["สนใจ"]})).matched, true);
    assert.equal(matchKeyword("สนใจFind X10", config()).matched, true);
  });
  it("matches one of several Thai and English aliases", () => {
    const aliases = config({keywords:["สนใจ", "Find X10"]});
    assert.equal(matchKeyword("สนใจซื้อสินค้า", aliases).matched, true);
    assert.equal(matchKeyword("Please find x10", aliases).matched, true);
  });
  it("does not confuse X10 and X100", () => assert.equal(matchKeyword("สนใจ Find X100", config()).matched, false));
  it("exact prevents prefix/suffix text", () => {
    assert.equal(matchKeyword("find x10", config({matchMode:"EXACT"})).matched, true);
    assert.equal(matchKeyword("สนใจ Find X10", config({matchMode:"EXACT"})).matched, false);
  });
  it("rejects duplicate aliases", () => assert.equal(config({keywords:["FIND X10","find x10"]}), null));
  it("does not target unassigned OAs", () => assert.equal(targetsLineOa(config(), "22222222-2222-2222-2222-222222222222"), false));
  it("future store inclusion with explicit global mode", () => {
    assert.equal(targetsLineOa(config({targetMode:"ALL_ELIGIBLE",excludedLineOaIds:[oa]}),"22222222-2222-2222-2222-222222222222"),true);
    assert.equal(targetsLineOa(config({targetMode:"ALL_ELIGIBLE",excludedLineOaIds:[oa]}),oa),false);
  });
  it("exact outranks contains", () => {
    const items=[{id:"contains",triggerConfig:config()},{id:"exact",triggerConfig:config({matchMode:"EXACT",keywords:["สนใจ Find X10"],priority:0})}];
    assert.equal(chooseKeywordRule("สนใจ Find X10",items).rule?.id,"exact");
  });
  it("fails closed for equal priority conflict", () => {
    const items=[{id:"a",triggerConfig:config()},{id:"b",triggerConfig:config()}];
    assert.deepEqual(chooseKeywordRule("Find X10",items),{rule:null,ambiguous:true});
  });
  it("fails closed when equal-priority contains rules overlap in one message", () => {
    const items = [
      {id:"short", triggerConfig:config({keywords:["Find"]})},
      {id:"specific", triggerConfig:config({keywords:["Find X10"]})},
    ];
    assert.deepEqual(chooseKeywordRule("Find X10", items), {rule:null, ambiguous:true});
  });
  it("detects direct phrase overlap without confusing adjacent product numbers", () => {
    assert.equal(keywordPatternsOverlap("CONTAINS", "Find X10", "Find"), true);
    assert.equal(keywordPatternsOverlap("CONTAINS", "Find X10", "Find X100"), false);
  });
  it("uses the higher priority for same-specificity matches", () => {
    const items = [
      {id:"lower", triggerConfig:config({priority:2})},
      {id:"higher", triggerConfig:config({priority:20})},
    ];
    assert.equal(chooseKeywordRule("Find X10", items).rule?.id, "higher");
  });
});
