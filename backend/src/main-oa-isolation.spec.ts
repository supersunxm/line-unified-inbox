import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MainOaAccessService } from "./auth/main-oa-access.service";
import { ConversationsService } from "./conversations.service";

const query = { page: 1, pageSize: 25, sort: "latest-desc" as const };

test("store and Main OA conversation lists enforce opposite backend account scopes", async () => {
  const wheres: unknown[] = [];
  const prisma = {
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    conversation: {
      findMany: async ({ where }: { where: unknown }) => { wheres.push(where); return []; },
      count: async ({ where }: { where: unknown }) => { wheres.push(where); return 0; },
    },
  };
  const operations = { getOperationalConversationFilter: async () => ({}) };
  const service = new ConversationsService(prisma as never, operations as never);
  await service.list(query, null, "STORE");
  await service.list(query, null, "HEAD_OFFICE");
  assert.equal((wheres[0] as { lineOfficialAccount: { accountType: string } }).lineOfficialAccount.accountType, "STORE");
  assert.equal((wheres[2] as { lineOfficialAccount: { accountType: string } }).lineOfficialAccount.accountType, "HEAD_OFFICE");
  assert.equal((wheres[2] as { store?: unknown }).store, undefined);
});

test("Main OA permission is capability-based and not implied by ADMIN", () => {
  const access = new MainOaAccessService({} as never);
  assert.throws(() => access.assertAccess({ role: "ADMIN", permissions: { canAccessMainOa: false } } as never), ForbiddenException);
  assert.doesNotThrow(() => access.assertAccess({ role: "VIEWER", permissions: { canAccessMainOa: true } } as never));
  assert.throws(() => access.assertManage({ role: "ADMIN", permissions: { canAccessMainOa: true, canManageMainOa: false } } as never), ForbiddenException);
});

test("Main OA conversation authorization rejects STORE conversations without leaking them", async () => {
  const access = new MainOaAccessService({ conversation: { findFirst: async () => null } } as never);
  await assert.rejects(() => access.assertConversationAccess({ permissions: { canAccessMainOa: true } } as never, "store-conversation"), NotFoundException);
});
