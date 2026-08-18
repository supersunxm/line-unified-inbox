import assert from "node:assert/strict";
import test from "node:test";
import { CouponLineClientService } from "./coupon-line-client.service";
import type { LineCouponPayload } from "./coupon.types";

const payload: LineCouponPayload = {
  title: "Reno coupon",
  reward: { type: "discount", priceInfo: { type: "fixed", fixedAmount: 500 } },
  acquisitionCondition: { type: "normal" },
  startTimestamp: 1_787_161_600,
  endTimestamp: 1_788_198_399,
  timezone: "ASIA_BANGKOK",
  visibility: "UNLISTED",
  maxUseCountPerTicket: 1,
};

function requestUrl(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

void test("creates a coupon and returns LINE coupon ID", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedAuthorization = "";
  let capturedBody = "";
  globalThis.fetch = async (input, init) => {
    capturedUrl = requestUrl(input);
    capturedAuthorization = String((init?.headers as Record<string, string>).Authorization);
    capturedBody = typeof init?.body === "string" ? init.body : "";
    return new Response(JSON.stringify({ couponId: "coupon-123" }), {
      status: 200,
      headers: { "content-type": "application/json", "x-line-request-id": "req-1" },
    });
  };

  try {
    const result = await new CouponLineClientService().createCoupon("secret-token", payload);
    assert.equal(capturedUrl, "https://api.line.me/v2/bot/coupon");
    assert.equal(capturedAuthorization, "Bearer secret-token");
    assert.deepEqual(JSON.parse(capturedBody), payload);
    assert.deepEqual(result, { couponId: "coupon-123", requestId: "req-1" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("maps LINE 401 without exposing token", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ message: "invalid token" }), { status: 401 });
  try {
    await assert.rejects(
      () => new CouponLineClientService().createCoupon("top-secret-token", payload),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /Channel Access Token/);
        assert.doesNotMatch(error.message, /top-secret-token/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

void test("discontinues a coupon using the close endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedMethod = "";
  globalThis.fetch = async (input, init) => {
    capturedUrl = requestUrl(input);
    capturedMethod = String(init?.method);
    return new Response(null, { status: 200, headers: { "x-line-request-id": "req-close" } });
  };

  try {
    const result = await new CouponLineClientService().discontinueCoupon("secret-token", "coupon/123");
    assert.equal(capturedUrl, "https://api.line.me/v2/bot/coupon/coupon%2F123/close");
    assert.equal(capturedMethod, "PUT");
    assert.deepEqual(result, { requestId: "req-close" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
