import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { SunnSecretaryWebhookController } from "./sunn-secretary-webhook.controller";
import { SunnSecretaryCredentialsService } from "./sunn-secretary-credentials.service";
import { SunnSecretaryInboundService } from "./sunn-secretary-inbound.service";

const bot = "U" + "a".repeat(32);
const sign = (data: Buffer) => createHmac("sha256", "test-secret").update(data).digest("base64");

test("inbound HTTP boundary validates raw bytes and destination before persistence", async (t) => {
  const original = process.env.SUNN_SECRETARY_WEBHOOK_ENABLED;
  let reads = 0;
  let accepted = 0;
  let fail = false;
  const credentials = { inboundIdentity: async () => { reads++; return { botUserId: bot, channelSecret: "test-secret" }; } } as unknown as SunnSecretaryCredentialsService;
  const inbound = { accept: async () => { if (fail) throw new Error("private SQL detail"); accepted++; } } as unknown as SunnSecretaryInboundService;
  const controller = new SunnSecretaryWebhookController(credentials, inbound);
  const req = (rawBody: Buffer) => ({ rawBody }) as Parameters<typeof controller.receive>[0];
  const body = Buffer.from(JSON.stringify({ destination: bot, events: [] }));
  try {
    await t.test("disabled mode reads and writes nothing", async () => {
      delete process.env.SUNN_SECRETARY_WEBHOOK_ENABLED;
      await assert.rejects(controller.receive(req(body), sign(body)), /disabled/u);
      assert.equal(reads, 0); assert.equal(accepted, 0);
    });
    process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = "true";
    await t.test("legitimate signed verification is accepted", async () => {
      assert.deepEqual(await controller.receive(req(body), sign(body)), { received: true });
    });
    await t.test("bad signature and reserialized-body signature rejected", async () => {
      await assert.rejects(controller.receive(req(body), "invalid"), /Invalid LINE signature/u);
      await assert.rejects(controller.receive(req(Buffer.from(body.toString() + " ")), sign(body)), /Invalid LINE signature/u);
    });
    await t.test("another bot is rejected", async () => {
      const other = Buffer.from(JSON.stringify({ destination: "U" + "b".repeat(32), events: [] }));
      await assert.rejects(controller.receive(req(other), sign(other)), /Unrecognized LINE destination/u);
    });
    await t.test("malformed JSON and envelopes rejected", async () => {
      for (const value of ["{", "null", "[]", JSON.stringify({ destination: bot, events: {} }), JSON.stringify({ destination: bot, events: Array(21).fill({}) })]) {
        const raw = Buffer.from(value);
        await assert.rejects(controller.receive(req(raw), sign(raw)), /Malformed LINE payload|Invalid LINE payload|Unrecognized LINE destination/u);
      }
    });
    await t.test("payload bounded before credential reads", async () => {
      const before = reads;
      await assert.rejects(controller.receive(req(Buffer.alloc(128 * 1024 + 1)), "invalid"), /too large/u);
      assert.equal(reads, before);
    });
    assert.equal(accepted, 1);
    await t.test("persistence failures are retryable and redacted", async () => {
      fail = true;
      await assert.rejects(controller.receive(req(body), sign(body)), { message: "Secretary event persistence unavailable" });
    });
  } finally {
    if (original === undefined) delete process.env.SUNN_SECRETARY_WEBHOOK_ENABLED;
    else process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = original;
  }
});
