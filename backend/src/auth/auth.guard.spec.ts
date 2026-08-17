import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { AuthGuard, AuthUser } from "./auth.guard";

function context(request: { method: string; path: string; headers: Record<string, string> }) {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

function guardFor(user: AuthUser | null) {
  return new AuthGuard(
    new Reflector(),
    { authenticate: async () => user } as never,
    { canWriteAsStoreUser: async () => true } as never,
  );
}

const resetUser: AuthUser = {
  id: "reset-user",
  email: "reset@example.test",
  displayName: "Reset User",
  role: UserRole.VIEWER,
  isActive: true,
  status: "ACTIVE",
  mustChangePassword: true,
};

void test("forced password-change users can only use profile, password change, and logout routes", async () => {
  const guard = guardFor(resetUser);

  for (const path of ["/conversations", "/mobile/conversations", "/dashboard", "/dashboard/analytics", "/admin/registrations/pending", "/stores"]) {
    await assert.rejects(
      () => guard.canActivate(context({ method: "GET", path, headers: { authorization: "Bearer token" } })),
      (error: unknown) => error instanceof ForbiddenException && JSON.stringify(error.getResponse()) === JSON.stringify({ code: "PASSWORD_CHANGE_REQUIRED", message: "Password change required" }),
      `${path} should require a password change first`,
    );
  }

  for (const request of [
    { method: "GET", path: "/auth/me", headers: {} },
    { method: "POST", path: "/auth/change-password", headers: {} },
    { method: "POST", path: "/auth/logout", headers: {} },
    { method: "POST", path: "/auth/mobile/logout", headers: {} },
  ]) {
    assert.equal(await guard.canActivate(context(request)), true, `${request.method} ${request.path} should remain available`);
  }
});

void test("normal users remain able to access protected APIs", async () => {
  const normalUser = { ...resetUser, mustChangePassword: false };
  const guard = guardFor(normalUser);
  assert.equal(
    await guard.canActivate(context({ method: "GET", path: "/mobile/conversations", headers: { authorization: "Bearer token" } })),
    true,
  );
});

void test("the same session can access protected APIs after the password change clears the flag", async () => {
  const authenticatedUser = { ...resetUser };
  const guard = guardFor(authenticatedUser);
  const request = { method: "GET", path: "/mobile/conversations", headers: { authorization: "Bearer token" } };

  await assert.rejects(() => guard.canActivate(context(request)), ForbiddenException);
  authenticatedUser.mustChangePassword = false;
  assert.equal(await guard.canActivate(context(request)), true);
});
