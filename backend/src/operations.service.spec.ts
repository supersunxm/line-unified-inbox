import test from "node:test";
import assert from "node:assert/strict";
import { OperationsService } from "./operations/operations.service";

test("getOperationalConversationFilter returns empty when no reset", async () => {
  const fakePrisma: any = { operationalSession: { findFirst: async () => null } };
  const svc = new OperationsService(fakePrisma);
  const f = await svc.getOperationalConversationFilter();
  assert.deepEqual(f, {});
});

test("getOperationalConversationFilter returns gte filter when reset exists", async () => {
  const resetDate = new Date("2026-08-05T16:00:00Z");
  const fakePrisma: any = { operationalSession: { findFirst: async () => ({ resetAt: resetDate }) } };
  const svc = new OperationsService(fakePrisma);
  const f = await svc.getOperationalConversationFilter();
  assert.ok(typeof f === "object");
  // @ts-expect-error mock shape: latestMessageAt.gte is a Date in the fake prisma
  assert.deepEqual(f.latestMessageAt.gte.toISOString(), resetDate.toISOString());
});
