import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_RESPONSE_POSTBACK_PREFIX,
  buildAutoResponsePostbackData,
  parseAutoResponsePostbackData,
} from "./auto-response.utils";

describe("AutoResponse Utils", () => {
  describe("buildAutoResponsePostbackData", () => {
    it("builds canonical postback data string with prefix", () => {
      const ruleId = "550e8400-e29b-41d4-a716-446655440000";
      const result = buildAutoResponsePostbackData(ruleId);
      assert.equal(result, `oppo_ar:v1:${ruleId}`);
    });

    it("throws when ruleId is empty or not a string", () => {
      assert.throws(() => buildAutoResponsePostbackData(""), /ruleId is required/);
      assert.throws(() => buildAutoResponsePostbackData(null as any), /ruleId is required/);
    });
  });

  describe("parseAutoResponsePostbackData", () => {
    it("parses valid own postback payload", () => {
      const ruleId = "550e8400-e29b-41d4-a716-446655440000";
      const parsed = parseAutoResponsePostbackData(`oppo_ar:v1:${ruleId}`);
      assert.deepEqual(parsed, {
        isAutoResponse: true,
        ruleId,
      });
    });

    it("ignores payloads from unknown namespaces", () => {
      assert.deepEqual(parseAutoResponsePostbackData("coupon:claim:123"), {
        isAutoResponse: false,
      });
      assert.deepEqual(parseAutoResponsePostbackData("action=buy&item=42"), {
        isAutoResponse: false,
      });
      assert.deepEqual(parseAutoResponsePostbackData("random text"), {
        isAutoResponse: false,
      });
      assert.deepEqual(parseAutoResponsePostbackData(""), {
        isAutoResponse: false,
      });
      assert.deepEqual(parseAutoResponsePostbackData(null), {
        isAutoResponse: false,
      });
    });

    it("recognizes namespace but flags malformed ID safely", () => {
      assert.deepEqual(parseAutoResponsePostbackData("oppo_ar:v1:"), {
        isAutoResponse: true,
        ruleId: undefined,
      });
      assert.deepEqual(parseAutoResponsePostbackData("oppo_ar:v1:!@#$%^&*()"), {
        isAutoResponse: true,
        ruleId: undefined,
      });
    });
  });
});
