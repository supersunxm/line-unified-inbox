import { UnauthorizedException } from "@nestjs/common";
import assert from "node:assert/strict";
import test from "node:test";
import { InternalTikTokSyncGuard } from "./internal-sync.guard";

function createMockContext(headers: Record<string, string | undefined>): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
      }),
    }),
  };
}

test("InternalTikTokSyncGuard fails closed if TIKTOK_INTERNAL_SYNC_SECRET is not configured on server", () => {
  const originalSecret = process.env.TIKTOK_INTERNAL_SYNC_SECRET;
  delete process.env.TIKTOK_INTERNAL_SYNC_SECRET;

  try {
    const guard = new InternalTikTokSyncGuard();
    const context = createMockContext({
      "x-internal-tiktok-secret": "some_secret_value",
    });

    assert.throws(
      () => guard.canActivate(context),
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.match(err.message, /not configured/i);
        // Ensure secret value is never in the error message
        assert.doesNotMatch(err.message, /some_secret_value/);
        return true;
      }
    );
  } finally {
    process.env.TIKTOK_INTERNAL_SYNC_SECRET = originalSecret;
  }
});

test("InternalTikTokSyncGuard rejects requests with missing secret header", () => {
  const originalSecret = process.env.TIKTOK_INTERNAL_SYNC_SECRET;
  process.env.TIKTOK_INTERNAL_SYNC_SECRET = "test_internal_secret_999";

  try {
    const guard = new InternalTikTokSyncGuard();
    const context = createMockContext({});

    assert.throws(
      () => guard.canActivate(context),
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.match(err.message, /Missing internal service secret/i);
        assert.doesNotMatch(err.message, /test_internal_secret_999/);
        return true;
      }
    );
  } finally {
    process.env.TIKTOK_INTERNAL_SYNC_SECRET = originalSecret;
  }
});

test("InternalTikTokSyncGuard rejects requests with incorrect secret header", () => {
  const originalSecret = process.env.TIKTOK_INTERNAL_SYNC_SECRET;
  process.env.TIKTOK_INTERNAL_SYNC_SECRET = "correct_secret_value_12345";

  try {
    const guard = new InternalTikTokSyncGuard();
    const context = createMockContext({
      "x-internal-tiktok-secret": "wrong_secret_value_99999",
    });

    assert.throws(
      () => guard.canActivate(context),
      (err: any) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.match(err.message, /Invalid internal service secret/i);
        assert.doesNotMatch(err.message, /correct_secret_value_12345/);
        assert.doesNotMatch(err.message, /wrong_secret_value_99999/);
        return true;
      }
    );
  } finally {
    process.env.TIKTOK_INTERNAL_SYNC_SECRET = originalSecret;
  }
});

test("InternalTikTokSyncGuard accepts requests with exact matching secret header", () => {
  const originalSecret = process.env.TIKTOK_INTERNAL_SYNC_SECRET;
  process.env.TIKTOK_INTERNAL_SYNC_SECRET = "super_secure_internal_sync_secret_abc123";

  try {
    const guard = new InternalTikTokSyncGuard();
    const context = createMockContext({
      "x-internal-tiktok-secret": "super_secure_internal_sync_secret_abc123",
    });

    const result = guard.canActivate(context);
    assert.equal(result, true);
  } finally {
    process.env.TIKTOK_INTERNAL_SYNC_SECRET = originalSecret;
  }
});
