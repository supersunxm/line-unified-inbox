import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { LineStatelessTokenService } from "./line-stateless-token.service";

test("issues a stateless token with Channel ID and Channel Secret", async () => {
  const originalFetch = global.fetch;
  let capturedUrl = "";
  let capturedBody = "";
  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    capturedUrl = String(input);
    capturedBody = String(init?.body ?? "");
    return new Response(JSON.stringify({ access_token: "stateless-token", expires_in: 900, token_type: "Bearer" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const service = new LineStatelessTokenService({} as never, {} as never);
    const issued = await service.issueToken("123456789", "secret-value");
    assert.equal(capturedUrl, "https://api.line.me/oauth2/v3/token");
    assert.match(capturedBody, /grant_type=client_credentials/);
    assert.match(capturedBody, /client_id=123456789/);
    assert.match(capturedBody, /client_secret=secret-value/);
    assert.equal(issued.accessToken, "stateless-token");
    assert.equal(issued.expiresIn, 900);
  } finally {
    global.fetch = originalFetch;
  }
});

test("rejects invalid Messaging API credentials without persisting anything", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () => new Response(JSON.stringify({ error: "invalid_client" }), {
    status: 400,
    headers: { "content-type": "application/json" },
  })) as typeof fetch;

  try {
    const service = new LineStatelessTokenService({} as never, {} as never);
    await assert.rejects(() => service.issueToken("bad-id", "bad-secret"), BadRequestException);
  } finally {
    global.fetch = originalFetch;
  }
});

test("rotates generated stateless tokens for active Main OA accounts", async () => {
  const originalFetch = global.fetch;
  global.fetch = (async () => new Response(JSON.stringify({ access_token: "rotated-token", expires_in: 900, token_type: "Bearer" }), {
    status: 200,
    headers: { "content-type": "application/json" },
  })) as typeof fetch;

  const updates: unknown[] = [];
  const prisma = {
    lineOfficialAccount: {
      findMany: async () => [{
        id: "main-oa-1",
        channelId: "123456789",
        encryptedChannelSecret: "enc:channel-secret",
        lastWebhookReceivedAt: null,
        lastConnectionError: null,
      }],
      update: async (args: unknown) => { updates.push(args); return args; },
    },
  };
  const encryption = {
    decrypt: (value: string) => value.replace(/^enc:/, ""),
    encrypt: (value: string) => `enc:${value}`,
  };

  try {
    const service = new LineStatelessTokenService(prisma as never, encryption as never);
    await service.refreshAllHeadOfficeTokens();
    assert.equal(updates.length, 1);
    const update = updates[0] as { data: { encryptedChannelAccessToken: string } };
    assert.equal(update.data.encryptedChannelAccessToken, "enc:rotated-token");
  } finally {
    global.fetch = originalFetch;
  }
});
