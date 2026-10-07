import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isMessageTranslationEligible } from "../src/app/message-translation.ts";
import { messageTranslationText } from "../src/app/message-translation-i18n.ts";

const actionCode = readFileSync(new URL("../src/app/message-translation-action.tsx", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");

test("translation action is limited to ADMIN inbound non-empty text messages", () => {
  const inboundText = { direction: "INBOUND" as const, messageType: "TEXT" as const, originalText: "ข้อความ" };
  assert.equal(isMessageTranslationEligible(inboundText, "ADMIN"), true);
  assert.equal(isMessageTranslationEligible(inboundText, "VIEWER"), false);
  assert.equal(isMessageTranslationEligible({ ...inboundText, direction: "OUTBOUND" }, "ADMIN"), false);
  assert.equal(isMessageTranslationEligible({ ...inboundText, messageType: "IMAGE" }, "ADMIN"), false);
  assert.equal(isMessageTranslationEligible({ ...inboundText, originalText: "  " }, "ADMIN"), false);
});

test("manual action posts English target through the authenticated API helper", () => {
  assert.match(actionCode, /api\.translateMessage\(message\.id, "en"\)/);
  assert.match(apiCode, /`\/messages\/\$\{encodeURIComponent\(messageId\)\}\/translations`/);
  assert.match(apiCode, /method: "POST"/);
  assert.match(apiCode, /body: JSON\.stringify\(\{ targetLanguage \}\)/);
  assert.match(apiCode, /credentials: "include"/);
  assert.doesNotMatch(actionCode, /useEffect/);
});

test("translation action exposes loading, success, and friendly error states", () => {
  assert.match(actionCode, /text\.translating/);
  assert.match(actionCode, /text\.translationTitle/);
  assert.equal(messageTranslationText.en.translating, "Translating...");
  assert.equal(messageTranslationText.en.translationTitle, "AI Translation · English");
  assert.match(actionCode, /state\.translatedText/);
  assert.match(actionCode, /text\.translationUnavailable/);
  assert.equal(messageTranslationText.en.translationUnavailable, "Translation unavailable");
  assert.match(actionCode, /aria-live="polite"/);
});

test("successful translation exposes helpful and categorized incorrect feedback", () => {
  assert.match(actionCode, /text\.helpful/);
  assert.match(actionCode, /text\.incorrect/);
  assert.equal(messageTranslationText.en.helpful, "Helpful 👍");
  assert.equal(messageTranslationText.en.incorrect, "Incorrect 👎");
  for (const reason of ["meaning_issue", "terminology_issue", "other"]) {
    assert.match(actionCode, new RegExp(reason));
  }
  assert.match(actionCode, /api\.submitTranslationFeedback\(message\.id/);
  assert.match(actionCode, /targetLanguage: "en"/);
  assert.match(apiCode, /\/translations\/feedback/);
  assert.match(actionCode, /text\.feedbackRecorded/);
  assert.equal(messageTranslationText.en.feedbackRecorded, "Feedback recorded");
});
