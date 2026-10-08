import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, WebhookProcessingStatus } from "@prisma/client";
import { sunnReceiptKey, SunnSecretaryEventReceiptService } from "./sunn-secretary-event-receipt";
import type { PrismaService } from "../../prisma.service";

const bot = "U" + "a".repeat(32);
test("deterministic receipt keys are namespaced per bot and never expose raw IDs", () => {
  const key = sunnReceiptKey(bot, "event-1");
  assert.match(key, /^sunn-secretary:v1:[a-f0-9]{64}$/u);
  assert.equal(sunnReceiptKey(bot, "event-1"), key);
  assert.notEqual(sunnReceiptKey(bot, "event-2"), key);
  assert.notEqual(sunnReceiptKey("U" + "b".repeat(32), "event-1"), key);
  assert.throws(() => sunnReceiptKey(bot, ""), /Invalid/u);
  assert.throws(() => sunnReceiptKey("bad", "event-1"), /Invalid/u);
});

test("atomic receipt reservation never creates storefront-ready event", async () => {
  const seen = new Set<string>();
  const prisma = { webhookEvent: { create: async ({ data }: { data: { externalWebhookEventId: string; processingStatus: string; eventType: string; destination: string; processedAt: Date } }) => {
    assert.equal(data.processingStatus, WebhookProcessingStatus.IGNORED);
    assert.equal(data.eventType, "SUNN_SECRETARY_RESERVED");
    assert.equal(data.destination, bot);
    assert.ok(data.processedAt instanceof Date);
    if (seen.has(data.externalWebhookEventId)) {
      throw new Prisma.PrismaClientKnownRequestError("duplicate", { code: "P2002", clientVersion: "test" });
    }
    seen.add(data.externalWebhookEventId);
  } } } as unknown as PrismaService;
  const receipts = new SunnSecretaryEventReceiptService(prisma);
  assert.deepEqual(await Promise.all([receipts.reserve(bot, "ev1"), receipts.reserve(bot, "ev1")]), ["NEW", "DUPLICATE"]);
  assert.equal(await receipts.reserve(bot, "ev2"), "NEW");
});

test("database failures fail closed rather than looking like fresh events", async () => {
  const prisma = { webhookEvent: { create: async () => { throw new Error("db unavailable"); } } } as unknown as PrismaService;
  await assert.rejects(() => new SunnSecretaryEventReceiptService(prisma).reserve(bot, "ev1"), /db unavailable/u);
});
