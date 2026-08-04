import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { TranslationEventService } from "./translation-event.service";

const event = {
  messageId: "message-1",
  adminId: "admin-1",
  targetLanguage: "en" as const,
  provider: "google",
  status: "SUCCESS" as const,
  durationMs: 120,
  characterCount: 24,
};

test("translation event service persists metadata only", async () => {
  let createArgs: unknown;
  const prisma = {
    translationEvent: {
      create: async (args: unknown) => {
        createArgs = args;
        return { id: "event-1" };
      },
    },
  } as unknown as PrismaService;

  await new TranslationEventService(prisma).record(event);
  assert.deepEqual(createArgs, { data: event, select: { id: true } });
  const serialized = JSON.stringify(createArgs);
  assert.equal(serialized.includes("originalText"), false);
  assert.equal(serialized.includes("translatedText"), false);
});

test("translation event persistence failure does not change translation behavior", async () => {
  const prisma = {
    translationEvent: {
      create: async () => {
        throw new Error("database unavailable");
      },
    },
  } as unknown as PrismaService;

  await assert.doesNotReject(new TranslationEventService(prisma).record(event));
});
