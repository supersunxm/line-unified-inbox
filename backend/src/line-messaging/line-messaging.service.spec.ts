import assert from "node:assert/strict";
import test from "node:test";
import { BadGatewayException, ServiceUnavailableException } from "@nestjs/common";
import { LineMessagingService } from "./line-messaging.service";

const input = {
  accessToken: "server-only-token",
  lineUserId: "Utest",
  text: "สวัสดีครับ",
  retryKey: "123e4567-e89b-42d3-a456-426614174000",
};

void test("pushText sends the LINE OA token and retry key and captures provider metadata", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer server-only-token");
    assert.equal(new Headers(init?.headers).get("X-Line-Retry-Key"), input.retryKey);
    assert.deepEqual(JSON.parse(init?.body as string), { to: "Utest", messages: [{ type: "text", text: "สวัสดีครับ" }] });
    return new Response(JSON.stringify({ sentMessages: [{ id: "line-message-1" }] }), {
      status: 200,
      headers: { "x-line-request-id": "request-1" },
    });
  };
  const result = await new LineMessagingService().pushText(input);
  assert.deepEqual(result, { requestId: "request-1", acceptedRequestId: null, externalMessageId: "line-message-1", duplicateAccepted: false });
});

void test("pushText treats LINE 409 with an accepted request id as an idempotent success", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response(JSON.stringify({ sentMessages: [{ id: "line-message-1" }] }), {
    status: 409,
    headers: { "x-line-request-id": "retry-request", "x-line-accepted-request-id": "accepted-request" },
  });
  const result = await new LineMessagingService().pushText(input);
  assert.equal(result.duplicateAccepted, true);
  assert.equal(result.acceptedRequestId, "accepted-request");
});

void test("pushText maps credential and network failures without exposing tokens", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response("unauthorized", { status: 401 });
  await assert.rejects(() => new LineMessagingService().pushText(input), (error: unknown) => error instanceof BadGatewayException && !error.message.includes(input.accessToken));
  globalThis.fetch = async () => { throw new Error(`network ${input.accessToken}`); };
  await assert.rejects(() => new LineMessagingService().pushText(input), (error: unknown) => error instanceof ServiceUnavailableException && !error.message.includes(input.accessToken));
});

void test("pushImage sends original and preview URLs with the retry key", async (t) => {
  const originalFetch = globalThis.fetch;
  let request: RequestInit | undefined;
  globalThis.fetch = (async (_input, init) => { request = init; return new Response(JSON.stringify({ sentMessages: [{ id: "line-image" }] }), { status: 200, headers: { "content-type": "application/json", "x-line-request-id": "request" } }); }) as typeof fetch;
  try {
    const result = await new LineMessagingService().pushImage({ accessToken: "token", lineUserId: "Ucustomer", originalContentUrl: "https://backend.example.com/messages/media/public?a", previewImageUrl: "https://backend.example.com/messages/media/public?a", retryKey: "123e4567-e89b-42d3-a456-426614174000" });
    assert.equal(result.externalMessageId, "line-image");
    assert.deepEqual(JSON.parse(request?.body as string), { to: "Ucustomer", messages: [{ type: "image", originalContentUrl: "https://backend.example.com/messages/media/public?a", previewImageUrl: "https://backend.example.com/messages/media/public?a" }] });
  } finally { globalThis.fetch = originalFetch; }
});
