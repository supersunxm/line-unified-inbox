import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  AUTO_RESPONSE_POSTBACK_PREFIX,
  buildAutoResponsePostbackData,
  detectImageMagicBytes,
  detectImageMime,
  normalizeAutoResponseMessages,
  parseAutoResponsePostbackData,
  validateAutoResponseMessages,
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

  describe("detectImageMagicBytes", () => {
    it("detects PNG magic bytes", () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
      assert.equal(detectImageMagicBytes(pngBuffer), "png");
      assert.equal(detectImageMime(pngBuffer), "image/png");
    });

    it("detects JPEG magic bytes", () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
      assert.equal(detectImageMagicBytes(jpegBuffer), "jpeg");
      assert.equal(detectImageMime(jpegBuffer), "image/jpeg");
    });

    it("rejects unknown formats like GIF, WEBP, or plain text", () => {
      const gifBuffer = Buffer.from("GIF89a...");
      assert.equal(detectImageMagicBytes(gifBuffer), "unknown");
      assert.equal(detectImageMime(gifBuffer), null);

      const textBuffer = Buffer.from("Hello world");
      assert.equal(detectImageMagicBytes(textBuffer), "unknown");
      assert.equal(detectImageMime(textBuffer), null);
    });
  });

  describe("normalizeAutoResponseMessages", () => {
    it("normalizes legacy single text rule", () => {
      const legacy = { textTemplate: "Hello from legacy!" };
      const normalized = normalizeAutoResponseMessages(legacy);
      assert.equal(normalized.length, 1);
      assert.equal(normalized[0].type, "TEXT");
      assert.equal((normalized[0] as any).textTemplate, "Hello from legacy!");
    });

    it("normalizes Phase 2 multi-message contentJson", () => {
      const rule = {
        contentJson: {
          version: 1,
          messages: [
            { id: "b1", type: "IMAGE" as const, mediaObjectKey: "key1" },
            { id: "b2", type: "TEXT" as const, textTemplate: "Promo text" },
          ],
        },
      };
      const normalized = normalizeAutoResponseMessages(rule);
      assert.equal(normalized.length, 2);
      assert.equal(normalized[0].type, "IMAGE");
      assert.equal(normalized[1].type, "TEXT");
    });
  });

  describe("validateAutoResponseMessages", () => {
    it("accepts valid 1-5 message blocks", () => {
      const valid = validateAutoResponseMessages([
        { id: "1", type: "IMAGE", mediaObjectKey: "line-media/img.jpg" },
        { id: "2", type: "TEXT", textTemplate: "Hello" },
        { id: "3", type: "TEXT", textTemplate: "World" },
      ]);
      assert.equal(valid.valid, true);
      assert.equal(valid.errors.length, 0);
    });

    it("rejects empty builder", () => {
      const res = validateAutoResponseMessages([]);
      assert.equal(res.valid, false);
      assert.match(res.errors[0], /at least 1 message block/);
    });

    it("rejects more than 5 message blocks", () => {
      const res = validateAutoResponseMessages([
        { id: "1", type: "TEXT", textTemplate: "1" },
        { id: "2", type: "TEXT", textTemplate: "2" },
        { id: "3", type: "TEXT", textTemplate: "3" },
        { id: "4", type: "TEXT", textTemplate: "4" },
        { id: "5", type: "TEXT", textTemplate: "5" },
        { id: "6", type: "TEXT", textTemplate: "6" },
      ]);
      assert.equal(res.valid, false);
      assert.match(res.errors[0], /cannot exceed 5/);
    });

    it("rejects empty text in TEXT block", () => {
      const res = validateAutoResponseMessages([
        { id: "1", type: "TEXT", textTemplate: "   " },
      ]);
      assert.equal(res.valid, false);
      assert.match(res.errors[0], /cannot be empty/);
    });

    it("rejects missing mediaObjectKey in IMAGE block", () => {
      const res = validateAutoResponseMessages([
        { id: "1", type: "IMAGE", mediaObjectKey: "" },
      ]);
      assert.equal(res.valid, false);
      assert.match(res.errors[0], /missing media object key/);
    });
  });
});
