import assert from "node:assert/strict";
import test from "node:test";
import { ConflictException, ForbiddenException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import { HqRegistrationService } from "./hq-registration.service";
import { ChangeHqRoleDto } from "./hq-role.dto";
import { validate } from "class-validator";

type Role = "ADMIN" | "ASSISTANT";
function fixture(options: { admins?: number; actorRole?: Role; targetRole?: Role; auditFails?: boolean } = {}) {
  let target = { id: "target", role: options.targetRole ?? "ADMIN", status: UserStatus.ACTIVE,
    isActive: true, canManageAccounts: true, canAccessWeb: true, canAccessMobile: true,
    canAccessAllStores: true, canReply: true, canAccessMainOa: true, canManageMainOa: true,
    passwordHash: "unchanged-fixture", memberships: ["store-a"], session: "unchanged-fixture" };
  const actor = { role: options.actorRole ?? UserRole.ADMIN, status: UserStatus.ACTIVE, isActive: true, canManageAccounts: true };
  const audits: Array<{ actorUserId: string; targetUserId: string; action: string; metadata: { previousRole: Role; newRole: Role } }> = [];
  let locked = false;
  const tx = {
    $executeRaw: async () => { locked = true; return 1; },
    user: {
      findUnique: async () => actor,
      findFirst: async () => { assert.equal(locked, true); return target; },
      count: async () => { assert.equal(locked, true); return options.admins ?? 2; },
      updateMany: async ({ data }: { data: { role: Role; canManageAccounts: boolean } }) => {
        assert.equal(locked, true);
        target = { ...target, ...data };
        return { count: 1 };
      },
    },
    auditLog: {
      create: async ({ data }: { data: typeof audits[number] }) => {
        if (options.auditFails) throw new Error("audit unavailable");
        audits.push(data);
        return {};
      },
    },
  };
  const prisma = { user: { findUnique: async () => actor, findFirst: async () => target },
    $transaction: async (operation: (transaction: typeof tx) => Promise<unknown>) => {
      const before = { ...target };
      try { return await operation(tx); } catch (error) { target = before; throw error; }
    } };
  return { service: new HqRegistrationService(prisma as never, {} as never),
    target: () => target, audits, actor };
}

void test("administrator demotes and promotes another HQ user, preserving unrelated configuration and sessions with atomic audit", async () => {
  const f = fixture();
  const before = { ...f.target() };
  assert.deepEqual(await f.service.changeRole("target", UserRole.ASSISTANT, "actor"), { userId: "target", role: UserRole.ASSISTANT, changed: true });
  assert.deepEqual(f.target(), { ...before, role: UserRole.ASSISTANT, canManageAccounts: false });
  assert.deepEqual(f.audits[0], { actorUserId: "actor", action: "HQ_ACCOUNT_ROLE_CHANGED", targetUserId: "target", metadata: { previousRole: "ADMIN", newRole: "ASSISTANT" }, ipAddress: undefined, userAgent: undefined });
  await f.service.changeRole("target", UserRole.ADMIN, "actor");
  assert.deepEqual(f.target(), before);
  assert.equal(f.audits[1].metadata.newRole, "ADMIN");
});

void test("Assistant cannot change own or another HQ role, even with stale manageAccounts grant", async () => {
  const f = fixture({ actorRole: "ASSISTANT" });
  for (const id of ["actor", "target"]) {
    await assert.rejects(() => f.service.changeRole(id, UserRole.ADMIN, "actor"), ForbiddenException);
  }
  assert.equal(f.audits.length, 0);
});

void test("last active administrator cannot be demoted", async () => {
  const f = fixture({ admins: 1 });
  await assert.rejects(() => f.service.changeRole("target", UserRole.ASSISTANT, "actor"), ConflictException);
  assert.equal(f.target().role, "ADMIN");
  assert.equal(f.audits.length, 0);
});

void test("last active administrator cannot be deactivated; self-deactivation remains forbidden", async () => {
  const f = fixture({ admins: 1 });
  await assert.rejects(() => f.service.deactivate("target", "actor"), ConflictException);
  await assert.rejects(() => f.service.deactivate("actor", "actor"), ForbiddenException);
  assert.equal(f.target().isActive, true);
});

void test("actor privilege is rechecked after acquiring the transactional lock", async () => {
  const f = fixture();
  const change = f.service.changeRole("target", UserRole.ASSISTANT, "actor");
  f.actor.role = UserRole.ASSISTANT;
  await assert.rejects(() => change, ForbiddenException);
  assert.equal(f.target().role, "ADMIN");
});

void test("audit failure rolls role mutation back; unchanged role has no duplicate audit", async () => {
  const f = fixture({ auditFails: true });
  await assert.rejects(() => f.service.changeRole("target", UserRole.ASSISTANT, "actor"), /audit unavailable/);
  assert.equal(f.target().role, "ADMIN");
  const same = fixture();
  assert.equal((await same.service.changeRole("target", UserRole.ADMIN, "actor")).changed, false);
  assert.equal(same.audits.length, 0);
});

void test("role DTO rejects arbitrary permission escalation fields and unsupported roles", async () => {
  assert.ok((await validate(Object.assign(new ChangeHqRoleDto(), { role: "ADMIN", canManageAccounts: true }), { whitelist: true, forbidNonWhitelisted: true })).length > 0);
  for (const role of ["VIEWER", "SUPERADMIN", "", null]) {
    const dto = Object.assign(new ChangeHqRoleDto(), { role });
    assert.ok((await validate(dto)).length > 0);
  }
  for (const role of ["ADMIN", "ASSISTANT"]) {
    assert.equal((await validate(Object.assign(new ChangeHqRoleDto(), { role }))).length, 0);
  }
});
