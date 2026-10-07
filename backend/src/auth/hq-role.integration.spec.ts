import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { HqRegistrationService } from "./hq-registration.service";
import { PasswordService } from "./password.service";

const databaseUrl = process.env.AUTH_ROLE_TEST_DATABASE_URL;

void test("PostgreSQL role transactions serialize concurrent demotions, retain one administrator and preserve unrelated grants with audit", { skip: !databaseUrl }, async () => {
  assert.ok(databaseUrl);
  assert.match(new URL(databaseUrl).pathname, /authorization_role_transactions_test$/);
  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    assert.equal(await db.user.count({ where: { role: "ADMIN", isActive: true, status: "ACTIVE" } }), 0, "Use a dedicated empty role-test database");
    const prefix = randomUUID();
    const users = await Promise.all([0, 1].map((index) => db.user.create({ data: {
      email: `${prefix}-${index}@example.test`, normalizedEmail: `${prefix}-${index}@example.test`,
      displayName: `Role fixture ${index}`, employeeId: `${prefix}-${index}`,
      role: "ADMIN", isActive: true, status: "ACTIVE", canManageAccounts: true,
      canAccessHq: true, canAccessAllStores: true, canAccessWeb: true, canAccessMobile: true,
      canReply: true, canAccessMainOa: true, canManageMainOa: true,
    } })));
    const service = new HqRegistrationService(db as never, new PasswordService());
    const results = await Promise.allSettled([
      service.changeRole(users[1].id, "ASSISTANT", users[0].id),
      service.changeRole(users[0].id, "ASSISTANT", users[1].id),
    ]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const rejected = results.find((result) => result.status === "rejected");
    assert.ok(rejected?.status === "rejected" && rejected.reason instanceof ForbiddenException);
    const current = await db.user.findMany({ where: { id: { in: users.map((user) => user.id) } } });
    assert.equal(current.filter((user) => user.role === "ADMIN" && user.isActive).length, 1);
    for (const before of users) {
      const after = current.find((user) => user.id === before.id)!;
      for (const key of ["passwordHash", "isActive", "status", "canAccessWeb", "canAccessMobile", "canAccessHq", "canAccessAllStores", "canReply", "canAccessMainOa", "canManageMainOa"] as const) {
        assert.equal(after[key], before[key], key);
      }
    }
    const audit = await db.auditLog.findMany({ where: { action: "HQ_ACCOUNT_ROLE_CHANGED", targetUserId: { in: users.map((user) => user.id) } } });
    assert.equal(audit.length, 1);
    assert.deepEqual(audit[0].metadata, { previousRole: "ADMIN", newRole: "ASSISTANT" });
    assert.ok(audit[0].createdAt instanceof Date);
    const admin = current.find((user) => user.role === "ADMIN")!;
    await assert.rejects(() => service.changeRole(admin.id, "ASSISTANT", admin.id), ConflictException);
    await assert.rejects(() => service.deactivate(admin.id, admin.id), ForbiddenException);
  } finally { await db.$disconnect(); }
});
