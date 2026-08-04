import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { TranslationFeedbackService } from "./translation-feedback";

test("feedback signals increment aggregate counters after successful translations", () => {
  const feedback = new TranslationFeedbackService();
  feedback.recordAfterSuccessfulTranslation("TRANSLATED", "POSITIVE");
  feedback.recordAfterSuccessfulTranslation("CACHED", "TERMINOLOGY_ISSUE");
  feedback.recordAfterSuccessfulTranslation("TRANSLATED", "MEANING_ISSUE");
  assert.deepEqual(feedback.snapshot(), { positiveFeedbackCount: 1, terminologyIssueCount: 1, meaningIssueCount: 1 });
});

test("feedback is rejected unless a translation completed successfully", () => {
  const feedback = new TranslationFeedbackService();
  assert.throws(() => feedback.recordAfterSuccessfulTranslation("FAILED", "MEANING_ISSUE"), BadRequestException);
  assert.deepEqual(feedback.snapshot(), { positiveFeedbackCount: 0, terminologyIssueCount: 0, meaningIssueCount: 0 });
});

test("feedback service stores counters only and accepts no text or identity fields", () => {
  const feedback = new TranslationFeedbackService();
  feedback.recordAfterSuccessfulTranslation("TRANSLATED", "POSITIVE");
  assert.deepEqual(Object.keys(feedback.snapshot()).sort(), ["meaningIssueCount", "positiveFeedbackCount", "terminologyIssueCount"]);
  assert.ok(Object.values(feedback.snapshot()).every((value) => typeof value === "number"));
});
