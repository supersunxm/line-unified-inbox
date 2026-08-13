import assert from "node:assert/strict";
import test from "node:test";
import {
  LineMessagingApiError,
  LineMessagingService,
} from "./line-messaging.service";

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
  await assert.rejects(
    () => new LineMessagingService().pushText(input),
    (error: unknown) =>
      error instanceof LineMessagingApiError &&
      error.lineStatus === 401 &&
      !error.message.includes(input.accessToken),
  );
  globalThis.fetch = async () => { throw new Error(`network ${input.accessToken}`); };
  await assert.rejects(
    () => new LineMessagingService().pushText(input),
    (error: unknown) =>
      error instanceof LineMessagingApiError &&
      error.lineStatus === 0 &&
      !error.message.includes(input.accessToken),
  );
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

void test("multicast throws LineMessagingApiError with original LINE status and retryable flag", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const service = new LineMessagingService();
  const baseInput = {
    accessToken: "tok",
    to: ["U1"],
    messages: [{ type: "text", text: "hi" }],
    retryKey: "r1",
  };

  // 1. LINE 400 Bad Request -> non-retryable
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Invalid user ID" }), {
      status: 400,
      headers: { "x-line-request-id": "req-400" },
    });

  await assert.rejects(
    () => service.multicast(baseInput),
    (err: any) =>
      err.name === "LineMessagingApiError" &&
      err.lineStatus === 400 &&
      err.lineRequestId === "req-400" &&
      err.retryable === false &&
      err.lineErrorMessage === "Invalid user ID",
  );

  // 2. LINE 401 Unauthorized -> non-retryable
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Invalid Channel Access Token" }), {
      status: 401,
      headers: { "x-line-request-id": "req-401" },
    });

  await assert.rejects(
    () => service.multicast(baseInput),
    (err: any) =>
      err.name === "LineMessagingApiError" &&
      err.lineStatus === 401 &&
      err.lineRequestId === "req-401" &&
      err.retryable === false,
  );

  // 3. LINE 403 Forbidden -> non-retryable
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Access denied" }), {
      status: 403,
      headers: { "x-line-request-id": "req-403" },
    });

  await assert.rejects(
    () => service.multicast(baseInput),
    (err: any) =>
      err.name === "LineMessagingApiError" &&
      err.lineStatus === 403 &&
      err.lineRequestId === "req-403" &&
      err.retryable === false,
  );

  // 4. LINE 429 Rate limit -> retryable
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Rate limit exceeded" }), {
      status: 429,
      headers: { "x-line-request-id": "req-429" },
    });

  await assert.rejects(
    () => service.multicast(baseInput),
    (err: any) =>
      err.name === "LineMessagingApiError" &&
      err.lineStatus === 429 &&
      err.lineRequestId === "req-429" &&
      err.retryable === true,
  );

  // 5. LINE 500 Internal Server Error -> retryable
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ message: "Internal server error" }), {
      status: 500,
      headers: { "x-line-request-id": "req-500" },
    });

  await assert.rejects(
    () => service.multicast(baseInput),
    (err: any) =>
      err.name === "LineMessagingApiError" &&
      err.lineStatus === 500 &&
      err.lineRequestId === "req-500" &&
      err.retryable === true,
  );

  // 6. Network error / timeout -> retryable
  globalThis.fetch = async () => {
    throw new Error("fetch timeout");
  };

  await assert.rejects(
    () => service.multicast(baseInput),
    (err: any) =>
      err.name === "LineMessagingApiError" &&
      err.lineStatus === 0 &&
      err.retryable === true,
  );
});

