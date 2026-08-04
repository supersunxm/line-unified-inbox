import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { TranslationQualityReportService } from "./translation-quality-report.service";

function serviceFor({
  total = 5,
  successful = 4,
  averageDurationMs = 125.5,
  feedback = 4,
  helpful = 2,
}: {
  total?: number;
  successful?: number;
  averageDurationMs?: number;
  feedback?: number;
  helpful?: number;
} = {}) {
  let eventCountCall = 0;
  let feedbackCountCall = 0;
  const prisma = {
    translationEvent: {
      count: async () => [total, successful][eventCountCall++],
      aggregate: async () => ({ _avg: { durationMs: averageDurationMs } }),
    },
    messageTranslationFeedback: {
      count: async () => [feedback, helpful][feedbackCountCall++],
      groupBy: async () => [
        { issueCategory: "MEANING_ISSUE", _count: { _all: 1 } },
        { issueCategory: "TERMINOLOGY_ISSUE", _count: { _all: 1 } },
        { issueCategory: "OTHER", _count: { _all: 0 } },
      ],
    },
  } as unknown as PrismaService;
  return new TranslationQualityReportService(prisma);
}

test("quality report aggregates durable translations and feedback", async () => {
  assert.deepEqual(await serviceFor().createReport(), {
    totalTranslations: 5,
    successfulTranslations: 4,
    failureCount: 1,
    successRate: 80,
    averageDurationMs: 125.5,
    feedbackCount: 4,
    helpfulRate: 50,
    issueBreakdown: {
      meaning_issue: 1,
      terminology_issue: 1,
      other: 0,
    },
  });
});

test("quality report uses a safe zero rate when no feedback exists", async () => {
  const report = await serviceFor({ total: 0, successful: 0, averageDurationMs: 0, feedback: 0, helpful: 0 }).createReport();
  assert.equal(report.totalTranslations, 0);
  assert.equal(report.successfulTranslations, 0);
  assert.equal(report.failureCount, 0);
  assert.equal(report.successRate, 0);
  assert.equal(report.averageDurationMs, 0);
  assert.equal(report.helpfulRate, 0);
});

test("quality report source is read-only and has no provider dependency", async () => {
  const sources = await Promise.all([
    readFile(join(process.cwd(), "src/translation/translation-quality-report.service.ts"), "utf8"),
    readFile(join(process.cwd(), "scripts/translation-quality-report.ts"), "utf8"),
  ]);
  for (const source of sources) {
    assert.doesNotMatch(source, /google-translation|TRANSLATION_PROVIDER|\.translate\(/);
    assert.doesNotMatch(source, /\.(create|update|upsert|delete|deleteMany|updateMany)\(/);
  }
});
