import assert from "node:assert/strict";
import test from "node:test";
import { AuthRateLimitService } from "./auth-rate-limit.service";

void test("allows requests, isolates keys, and rejects after the configured window budget", async () => {
  const counts = new Map<string, number>();
  const prisma: any = {
    authRateLimitBucket: { findUnique: async ({ where }: any) => ({ count: counts.get(where.key_windowStart.key) ?? 0 }) },
    $queryRaw: async (_strings: TemplateStringsArray, ...values: any[]) => {
      const key = values[0] as string;
      const previous = counts.get(key) ?? 0;
      const limit = key.startsWith("registration:") ? 10 : 5;
      if (previous >= limit) return [];
      const next = previous + 1;
      counts.set(key, next);
      return [{ count: next }];
    },
  };
  const limiter = new AuthRateLimitService(prisma);
  for (let i = 0; i < 5; i += 1) await limiter.recordLoginFailure("ip-a", "a@example.com");
  await assert.rejects(() => limiter.assertLoginAllowed("ip-a", "a@example.com"), /Too many requests/);
  await limiter.recordLoginFailure("ip-b", "a@example.com");
  await limiter.recordLoginFailure("ip-a", "b@example.com");
  counts.clear();
  await limiter.assertLoginAllowed("ip-a", "a@example.com");
});

void test("registration buckets allow ten requests and reject the eleventh", async () => {
  let count = 0;
  const limiter = new AuthRateLimitService({ $queryRaw: async () => count >= 10 ? [] : [{ count: ++count }] } as any);
  for (let i = 0; i < 10; i += 1) await limiter.consumeRegistration("ip-a");
  await assert.rejects(() => limiter.consumeRegistration("ip-a"), /Too many requests/);
});
