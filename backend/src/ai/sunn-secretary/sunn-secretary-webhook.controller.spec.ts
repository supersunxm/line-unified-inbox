import assert from "node:assert/strict";
import test from "node:test";
import { createHmac } from "node:crypto";
import { SunnSecretaryWebhookController } from "./sunn-secretary-webhook.controller";

const bot = "U" + "a".repeat(32);
const controller = new SunnSecretaryWebhookController();
const original = {
  flag: process.env.SUNN_SECRETARY_WEBHOOK_ENABLED,
  secret: process.env.SUNN_SECRETARY_CHANNEL_SECRET,
  bot: process.env.SUNN_SECRETARY_BOT_USER_ID,
};
const body = Buffer.from(JSON.stringify({destination:bot,events:[]}), "utf8");
const sign = (data: Buffer) => createHmac("sha256", "test-secret").update(data).digest("base64");
const req = (data: Buffer) => ({rawBody:data}) as Parameters<typeof controller.receive>[0];
test("disabled by default: no external callback accepted", () => {
  delete process.env.SUNN_SECRETARY_WEBHOOK_ENABLED;
  assert.throws(()=>controller.receive(req(body),sign(body)),/disabled/u);
});
test("with explicit flag signature and destination are mandatory", () => {
  process.env.SUNN_SECRETARY_WEBHOOK_ENABLED = "true";
  process.env.SUNN_SECRETARY_CHANNEL_SECRET = "test-secret";
  process.env.SUNN_SECRETARY_BOT_USER_ID = bot;
  assert.deepEqual(controller.receive(req(body),sign(body)),{received:true});
  assert.throws(()=>controller.receive(req(body),"invalid"),/Invalid LINE signature/u);
  const other = Buffer.from(JSON.stringify({destination:"U"+"b".repeat(32),events:[]}));
  assert.throws(()=>controller.receive(req(other),sign(other)),/Unrecognized LINE destination/u);
  for (const [key,value] of Object.entries({SUNN_SECRETARY_WEBHOOK_ENABLED:original.flag,SUNN_SECRETARY_CHANNEL_SECRET:original.secret,SUNN_SECRETARY_BOT_USER_ID:original.bot})) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});
