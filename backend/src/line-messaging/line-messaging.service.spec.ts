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

void test("multicast sends to array of users and passes X-Line-Retry-Key and authorization", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let requestUrl = "";
  let requestInit: RequestInit | undefined;
  globalThis.fetch = async (url, init) => {
    requestUrl = String(url);
    requestInit = init;
    return new Response(JSON.stringify({}), {
      status: 200,
      headers: { "x-line-request-id": "multi-req-123" },
    });
  };

  const users = ["U1", "U2", "U3"];
  const messages = [{ type: "text", text: "Promotion text" }];
  const result = await new LineMessagingService().multicast({
    accessToken: "test-channel-token",
    to: users,
    messages,
    retryKey: "retry-uuid-1",
  });

  assert.equal(requestUrl, "https://api.line.me/v2/bot/message/multicast");
  assert.equal(new Headers(requestInit?.headers).get("Authorization"), "Bearer test-channel-token");
  assert.equal(new Headers(requestInit?.headers).get("X-Line-Retry-Key"), "retry-uuid-1");
  assert.deepEqual(JSON.parse(requestInit?.body as string), { to: users, messages });
  assert.equal(result.requestId, "multi-req-123");
  assert.equal(result.duplicateAccepted, false);
});

void test("multicast validates recipients between 1 and 500 and messages between 1 and 5", async () => {
  const service = new LineMessagingService();

  // 0 users
  await assert.rejects(
    () => service.multicast({ accessToken: "tok", to: [], messages: [{ type: "text", text: "hi" }], retryKey: "r1" }),
    /Multicast recipients must be between 1 and 500 users/,
  );

  // 501 users
  const tooManyUsers = Array.from({ length: 501 }, (_, i) => `U${i}`);
  await assert.rejects(
    () => service.multicast({ accessToken: "tok", to: tooManyUsers, messages: [{ type: "text", text: "hi" }], retryKey: "r1" }),
    /Multicast recipients must be between 1 and 500 users/,
  );

  // 0 messages
  await assert.rejects(
    () => service.multicast({ accessToken: "tok", to: ["U1"], messages: [], retryKey: "r1" }),
    /Multicast messages must be between 1 and 5 message objects/,
  );

  // 6 messages
  const tooManyMessages = Array.from({ length: 6 }, () => ({ type: "text", text: "hi" }));
  await assert.rejects(
    () => service.multicast({ accessToken: "tok", to: ["U1"], messages: tooManyMessages, retryKey: "r1" }),
    /Multicast messages must be between 1 and 5 message objects/,
  );
});

void test("multicast treats LINE 409 with acceptedRequestId as idempotent success", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async () => new Response("Conflict", {
    status: 409,
    headers: { "x-line-request-id": "req-999", "x-line-accepted-request-id": "accepted-999" },
  });

  const result = await new LineMessagingService().multicast({
    accessToken: "tok",
    to: ["U1"],
    messages: [{ type: "text", text: "hi" }],
    retryKey: "r-duplicate",
  });

  assert.equal(result.duplicateAccepted, true);
  assert.equal(result.acceptedRequestId, "accepted-999");
});

