import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isMessageTranslationEligible } from "../src/app/message-translation.ts";
import { messageTranslationText } from "../src/app/message-translation-i18n.ts";

const actionCode = readFileSync(new URL("../src/app/message-translation-action.tsx", import.meta.url), "utf8");
const apiCode = readFileSync(new URL("../src/lib/api.ts", import.meta.url), "utf8");
const pageCode = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");

test("translation action is available to authorized website roles for inbound non-empty text messages", () => {
  const inboundText = { direction: "INBOUND" as const, messageType: "TEXT" as const, originalText: "ข้อความ" };
  for (const role of ["ADMIN", "ASSISTANT", "VIEWER"] as const) assert.equal(isMessageTranslationEligible(inboundText, role), true);
  assert.equal(isMessageTranslationEligible({ ...inboundText, direction: "OUTBOUND" }, "ADMIN"), false);
  assert.equal(isMessageTranslationEligible({ ...inboundText, messageType: "IMAGE" }, "ADMIN"), false);
  assert.equal(isMessageTranslationEligible({ ...inboundText, originalText: "  " }, "ADMIN"), false);
});

test("manual action posts the selected English or Chinese target through the authenticated API helper", () => {
  assert.match(actionCode, /type TargetLanguage = "en" \| "zh"/);
  assert.match(actionCode, /\(\["en", "zh"\] as const\)\.map/);
  assert.match(actionCode, /setTargetLanguage\(target\)/);
  assert.match(actionCode, /api\.translateMessage\(message\.id, targetLanguage\)/);
  assert.match(actionCode, /onTranslated\(targetLanguage, result\.translatedText\)/);
  assert.match(pageCode, /function updateMessageTranslation\(messageId: string, targetLanguage: "en" \| "zh", translatedText: string\)/);
  assert.match(pageCode, /targetLanguage === "en" \? \{ translatedEnglish: translatedText \} : \{ translatedChinese: translatedText \}/);
  assert.match(actionCode, /setState\(\{ status: "idle" \}\)/);
  assert.match(actionCode, /setFeedbackState\("idle"\)/);
  assert.match(apiCode, /translateMessage: \(messageId: string, targetLanguage: "en" \| "zh"\)/);
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
  assert.match(actionCode, /api\.submitTranslationFeedback\(message\.id,\s*\{\s*targetLanguage,\s*rating,/);
  assert.doesNotMatch(actionCode, /targetLanguage: "en"/);
  assert.match(actionCode, /targetLanguage === "en" \? text\.translationTitleEnglish : text\.translationTitleChinese/);
  assert.match(apiCode, /\/translations\/feedback/);
  assert.match(actionCode, /text\.feedbackRecorded/);
  assert.equal(messageTranslationText.en.feedbackRecorded, "Feedback recorded");
});

test("English and Chinese target labels and result titles exist in every UI language", () => {
  const expectedLabels = {
    th: { english: "อังกฤษ", chinese: "中文", translationTitleChinese: "แปลด้วย AI · ภาษาจีน" },
    en: { english: "English", chinese: "中文", translationTitleChinese: "AI Translation · Chinese" },
    zh: { english: "英语", chinese: "中文", translationTitleChinese: "AI 翻译 · 中文" },
  } as const;

  for (const [language, expected] of Object.entries(expectedLabels)) {
    assert.equal(messageTranslationText[language as keyof typeof messageTranslationText].english, expected.english);
    assert.equal(messageTranslationText[language as keyof typeof messageTranslationText].chinese, expected.chinese);
    assert.equal(messageTranslationText[language as keyof typeof messageTranslationText].translationTitleChinese, expected.translationTitleChinese);
  }
});
