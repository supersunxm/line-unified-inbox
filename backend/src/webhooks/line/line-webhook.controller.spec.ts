import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { GoneException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { LineWebhookController } from "./line-webhook.controller";
import { LineSignatureService } from "./line-signature.service";
import { LineWebhookService } from "./line-webhook.service";
import { LineWebhookConfig } from "./line-webhook.config";
import { IS_PUBLIC } from "../../auth/auth.decorators";

const secret = "test-secret";
const rawBody = Buffer.from('{"events":[]}');
const signature = createHmac("sha256", secret).update(rawBody).digest("base64");
const request = { rawBody } as never;

function controller(resolution: Record<string, unknown>) {
  const service = {
    resolveSignatureCredentialByWebhookKey: () => Promise.resolve(resolution),
    accept: () => Promise.resolve({ success: true }),
  } as unknown as LineWebhookService;
  return new LineWebhookController(new LineSignatureService(), service, { enabled: true } as LineWebhookConfig);
}

void test("unique LINE webhook route is registered as POST", () => {
  const receiveForOa = Object.getOwnPropertyDescriptor(LineWebhookController.prototype, "receiveForOa")?.value as object;
  assert.equal(Reflect.getMetadata(PATH_METADATA, LineWebhookController), "webhook");
  assert.equal(Reflect.getMetadata(PATH_METADATA, receiveForOa), ":webhookKey");
  assert.equal(Reflect.getMetadata(METHOD_METADATA, receiveForOa), 1);
  assert.equal(Reflect.getMetadata(IS_PUBLIC, LineWebhookController), true);
  assert.equal(Object.hasOwn(LineWebhookController.prototype, "receive"), false);
});

void test("valid persisted key and valid empty-events Verify request return 200 result", async () => {
  const result = await controller({ secret, source: "database OA credential", oa: { id: "oa-1", name: "OA", store: "Store", isActive: true, isArchived: false } })
    .receiveForOa("persisted-key", request, signature, { events: [] });
  assert.deepEqual(result, { success: true });
});

void test("unknown or deleted webhook key returns 404", async () => {
  await assert.rejects(() => controller({ source: "none" }).receiveForOa("old-key", request, signature, { events: [] }), NotFoundException);
});

void test("archived or disabled webhook key returns 410", async () => {
  await assert.rejects(() => controller({ source: "none", oa: { id: "oa-1", name: "OA", store: "Store", isActive: false, isArchived: true } }).receiveForOa("archived-key", request, signature, { events: [] }), GoneException);
});

void test("invalid signature returns 401 only after key resolution", async () => {
  let resolved = false;
  const service = { resolveSignatureCredentialByWebhookKey: () => { resolved = true; return Promise.resolve({ secret, source: "database OA credential", oa: { id: "oa-1", name: "OA", store: "Store", isActive: true } }); } } as unknown as LineWebhookService;
  const instance = new LineWebhookController(new LineSignatureService(), service, { enabled: true } as LineWebhookConfig);
  await assert.rejects(() => instance.receiveForOa("persisted-key", request, "invalid", { events: [] }), UnauthorizedException);
  assert.equal(resolved, true);
});
