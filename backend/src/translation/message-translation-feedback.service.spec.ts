import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, UnprocessableEntityException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { Prisma } from "@prisma/client";
import { MessageTranslationFeedbackService } from "./message-translation-feedback.service";
import { TranslationFeedbackService } from "./translation-feedback";

const translatedText = "OPPO Reno16 is available.";

function fixture(translation: string | null = translatedText, duplicate = false) {
  const createData: Array<Record<string, unknown>> = [];
  const prisma = {
    message: {
      findUnique: async () => ({ translatedEnglish: translation, translatedChinese: null }),
    },
    messageTranslationFeedback: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        if (duplicate) {
          throw new Prisma.PrismaClientKnownRequestError("duplicate", {
            code: "P2002",
            clientVersion: "test",
          });
        }
        createData.push(data);
        return {
          id: "feedback-1",
          ...data,
          createdAt: new Date("2026-08-04T10:00:00.000Z"),
        };
      },
      findUniqueOrThrow: async () => ({
        id: "existing-feedback",
        messageId: "message-1",
        adminUserId: "admin-1",
        targetLanguage: "en",
        translationHash: createHash("sha256").update(translatedText, "utf8").digest("hex"),
        rating: "HELPFUL",
        issueCategory: null,
        createdAt: new Date("2026-08-04T09:00:00.000Z"),
      }),
    },
  } as unknown as PrismaService;
  const aggregates = new TranslationFeedbackService();
  return {
    service: new MessageTranslationFeedbackService(prisma, aggregates),
    aggregates,
    createData,
  };
}

test("helpful feedback stores a safe link to the exact existing translation", async () => {
  const { service, aggregates, createData } = fixture();
  const response = await service.submit("message-1", { targetLanguage: "en", rating: "HELPFUL" }, "admin-1");
  assert.deepEqual(response, {
    id: "feedback-1",
    messageId: "message-1",
    targetLanguage: "en",
    rating: "HELPFUL",
    issueCategory: null,
    createdAt: new Date("2026-08-04T10:00:00.000Z"),
    recorded: true,
  });
  assert.deepEqual(createData[0], {
    messageId: "message-1",
    adminUserId: "admin-1",
    targetLanguage: "en",
    translationHash: createHash("sha256").update(translatedText, "utf8").digest("hex"),
    rating: "HELPFUL",
    issueCategory: null,
  });
  assert.equal(JSON.stringify(createData).includes(translatedText), false);
  assert.equal(aggregates.snapshot().positiveFeedbackCount, 1);
});

test("incorrect feedback requires and maps an approved issue category", async () => {
  const { service, aggregates, createData } = fixture();
  await assert.rejects(
    service.submit("message-1", { targetLanguage: "en", rating: "INCORRECT" }, "admin-1"),
    BadRequestException,
  );
  await service.submit(
    "message-1",
    { targetLanguage: "en", rating: "INCORRECT", issueCategory: "terminology_issue" },
    "admin-1",
  );
  assert.equal(createData[0].issueCategory, "TERMINOLOGY_ISSUE");
  assert.equal(aggregates.snapshot().terminologyIssueCount, 1);
});

test("feedback is rejected without a stored translation and never calls a provider", async () => {
  const { service, createData } = fixture(null);
  await assert.rejects(
    service.submit("message-1", { targetLanguage: "en", rating: "HELPFUL" }, "admin-1"),
    UnprocessableEntityException,
  );
  assert.equal(createData.length, 0);
  assert.equal("provider" in service, false);
});

test("repeat feedback for the same translation is idempotent and does not double-count", async () => {
  const { service, aggregates } = fixture(translatedText, true);
  const response = await service.submit("message-1", { targetLanguage: "en", rating: "HELPFUL" }, "admin-1");
  assert.equal(response.id, "existing-feedback");
  assert.equal(response.recorded, false);
  assert.equal(aggregates.snapshot().positiveFeedbackCount, 0);
});
