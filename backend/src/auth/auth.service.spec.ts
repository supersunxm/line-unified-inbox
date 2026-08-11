import assert from "node:assert/strict";
import test from "node:test";
import { AuthService } from "./auth.service";

void test("authenticated mobile profile includes stores, membership roles, and derived permissions", async () => {
  const rawToken = "mobile-token";
  const prisma = {
    session: {
      findUnique: async () => ({
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: "user-1", email: "staff@example.test", displayName: "Staff", role: "VIEWER", isActive: true, status: "ACTIVE", phone: "+66812345678", firstName: "First", lastName: "Last", employeeId: "EMP-1", position: "PC",
          memberships: [{ id: "membership-1", storeId: "store-1", role: "STAFF", store: { id: "store-1", name: "Store 1", code: "S1" } }],
        },
      }),
    },
  };
  const result = await new AuthService(prisma as never, {} as never).authenticate(rawToken);
  assert.equal(result?.permissions?.canReply, true);
  assert.deepEqual(result?.permissions?.membershipRoles, ["STAFF"]);
  assert.deepEqual(result?.stores, [{ id: "store-1", name: "Store 1", code: "S1" }]);
  assert.deepEqual(result?.profile, { firstName: "First", lastName: "Last", employeeId: "EMP-1", position: "PC", phone: "+66812345678" });
});
