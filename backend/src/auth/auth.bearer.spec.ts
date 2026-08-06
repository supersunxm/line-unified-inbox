import test from "node:test";
import assert from "node:assert/strict";
import { AuthGuard } from "./auth.guard";
import { UserRole } from "@prisma/client";

test("AuthGuard accepts both oppo_session cookie and Authorization Bearer header", async () => {
  const adminUser = { id: "u-admin", email: "admin@oppo.th", displayName: "Admin User", role: UserRole.ADMIN, isActive: true };

  const fakeAuthService: any = {
    authenticate: async (token?: string) => {
      if (token === "valid-session-token") return adminUser;
      return null;
    },
  };

  const fakeReflector: any = {
    getAllAndOverride: (key: string) => {
      if (key === "isPublic") return false;
      if (key === "roles") return [UserRole.ADMIN];
      return undefined;
    },
  };

  const guard = new AuthGuard(fakeReflector, fakeAuthService);

  // Test 1: Cookie authentication
  const requestCookie: any = { headers: { cookie: "oppo_session=valid-session-token" }, method: "POST", path: "/operations/reset-counter" };
  const contextCookie: any = { switchToHttp: () => ({ getRequest: () => requestCookie }), getHandler: () => ({}), getClass: () => ({}) };
  const resCookie = await guard.canActivate(contextCookie);
  assert.equal(resCookie, true);
  assert.deepEqual(requestCookie.user, adminUser);

  // Test 2: Bearer header authentication
  const requestBearer: any = { headers: { authorization: "Bearer valid-session-token" }, method: "POST", path: "/operations/reset-counter" };
  const contextBearer: any = { switchToHttp: () => ({ getRequest: () => requestBearer }), getHandler: () => ({}), getClass: () => ({}) };
  const resBearer = await guard.canActivate(contextBearer);
  assert.equal(resBearer, true);
  assert.deepEqual(requestBearer.user, adminUser);

  // Test 3: Unauthenticated request
  const requestUnauth: any = { headers: {}, method: "POST", path: "/operations/reset-counter" };
  const contextUnauth: any = { switchToHttp: () => ({ getRequest: () => requestUnauth }), getHandler: () => ({}), getClass: () => ({}) };
  await assert.rejects(async () => guard.canActivate(contextUnauth), { name: "UnauthorizedException", message: "Authentication required" });
});
