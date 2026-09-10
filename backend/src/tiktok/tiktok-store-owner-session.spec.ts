import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE,
  verifyTikTokStoreOwnerSession,
} from "./tiktok-store-owner-session";

function createCookie(
  accountId: string,
  storeMasterId: string,
  expiresAt: number,
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify({ accountId, storeMasterId, expiresAt }), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${TIKTOK_STORE_OWNER_ANALYTICS_SESSION_COOKIE}=${body}.${signature}`;
}

test("store-owner session verifier accepts only a valid scoped, unexpired cookie", () => {
  const originalSecret = process.env.TIKTOK_INTERNAL_SYNC_SECRET;
  const secret = "test-store-owner-backend-secret";
  process.env.TIKTOK_INTERNAL_SYNC_SECRET = secret;
  try {
    const expiresAt = Date.now() + 60_000;
    const cookie = createCookie("account-1", "store-1", expiresAt, secret);
    assert.deepEqual(verifyTikTokStoreOwnerSession(cookie), {
      accountId: "account-1",
      storeMasterId: "store-1",
      expiresAt,
    });
    assert.equal(verifyTikTokStoreOwnerSession(`${cookie}tampered`), null);
    assert.deepEqual(verifyTikTokStoreOwnerSession(`other=value; ${cookie}`), {
      accountId: "account-1",
      storeMasterId: "store-1",
      expiresAt,
    });
  } finally {
    if (originalSecret === undefined) delete process.env.TIKTOK_INTERNAL_SYNC_SECRET;
    else process.env.TIKTOK_INTERNAL_SYNC_SECRET = originalSecret;
  }
});

test("store-owner session verifier fails closed for expired or unconfigured sessions", () => {
  const originalSecret = process.env.TIKTOK_INTERNAL_SYNC_SECRET;
  const secret = "test-store-owner-backend-secret";
  process.env.TIKTOK_INTERNAL_SYNC_SECRET = secret;
  try {
    const expired = createCookie("account-1", "store-1", Date.now() - 1, secret);
    assert.equal(verifyTikTokStoreOwnerSession(expired), null);
    delete process.env.TIKTOK_INTERNAL_SYNC_SECRET;
    assert.equal(verifyTikTokStoreOwnerSession(expired), null);
  } finally {
    if (originalSecret === undefined) delete process.env.TIKTOK_INTERNAL_SYNC_SECRET;
    else process.env.TIKTOK_INTERNAL_SYNC_SECRET = originalSecret;
  }
});
