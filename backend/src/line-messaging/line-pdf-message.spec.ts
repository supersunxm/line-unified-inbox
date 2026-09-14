import assert from "node:assert/strict";
import test from "node:test";
import { buildPdfFlexMessage, formatPdfSize } from "./line-pdf-message";
import { LineMessagingService } from "./line-messaging.service";

void test("PDF Flex message exposes a customer HTTPS URL without storage keys", () => {
  const message = buildPdfFlexMessage({ filename: "quote.pdf", fileSize: 2 * 1024 * 1024, url: "https://files.example.test/d/11111111-1111-4111-8111-111111111111" });
  assert.equal(message.type, "flex");
  assert.equal(message.altText, "PDF: quote.pdf");
  const json = JSON.stringify(message);
  assert.match(json, /quote\.pdf/);
  assert.match(json, /files\.example\.test\/d\//);
  assert.doesNotMatch(json, /line-media\//);
  assert.equal(formatPdfSize(512), "512 B");
  assert.equal(formatPdfSize(2048), "2.0 KB");
});

void test("PDF Flex message refuses non-HTTPS customer URLs", () => {
  assert.throws(() => buildPdfFlexMessage({ filename: "quote.pdf", fileSize: 10, url: "http://localhost/d/token" }));
});

void test("LINE PDF reply uses the standard reply endpoint and FILE diagnostic type", async () => {
  const previousFetch = global.fetch;
  let request: { url: string; body: string; authorization: string } | undefined;
  global.fetch = (url: string | URL | Request, init?: RequestInit) => {
    request = {
      url: typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url,
      body: typeof init?.body === "string" ? init.body : "",
      authorization: new Headers(init?.headers).get("authorization") ?? "",
    };
    return Promise.resolve(new Response(JSON.stringify({ sentMessages: [{ id: "line-sent-pdf" }] }), { status: 200, headers: { "content-type": "application/json", "x-line-request-id": "request-pdf" } }));
  };
  try {
    const result = await new LineMessagingService().replyPdfDocument({ accessToken: "secret-token", replyToken: "reply-token", filename: "quote.pdf", fileSize: 10, url: "https://files.example.test/d/11111111-1111-4111-8111-111111111111" });
    assert.equal(result.success, true);
    assert.equal(result.externalMessageId, "line-sent-pdf");
    assert.equal(request?.url, "https://api.line.me/v2/bot/message/reply");
    assert.equal(request?.authorization, "Bearer secret-token");
    assert.match(request?.body ?? "", /application\/pdf/);
    assert.match(request?.body ?? "", /เปิดเอกสาร/);
  } finally {
    global.fetch = previousFetch;
  }
});

void test("LINE PDF push uses retry idempotency and the customer URL", async () => {
  const previousFetch = global.fetch;
  let headers: Headers | undefined;
  let body = "";
  global.fetch = (_url: string | URL | Request, init?: RequestInit) => {
    headers = new Headers(init?.headers);
    body = typeof init?.body === "string" ? init.body : "";
    return Promise.resolve(new Response(null, { status: 200, headers: { "x-line-request-id": "request-pdf-push" } }));
  };
  try {
    const result = await new LineMessagingService().pushPdfDocument({ accessToken: "secret-token", lineUserId: "line-user", filename: "quote.pdf", fileSize: 10, url: "https://files.example.test/d/11111111-1111-4111-8111-111111111111", retryKey: "11111111-1111-4111-8111-111111111111" });
    assert.equal(result.requestId, "request-pdf-push");
    assert.equal(headers?.get("x-line-retry-key"), "11111111-1111-4111-8111-111111111111");
    assert.match(body, /files\.example\.test\/d\//);
  } finally {
    global.fetch = previousFetch;
  }
});
