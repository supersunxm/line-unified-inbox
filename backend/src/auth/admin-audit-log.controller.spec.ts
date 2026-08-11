import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { REQUIRED_ROLES } from "./auth.decorators";
import { AdminAuditLogController } from "./admin-audit-log.controller";

void test("audit log endpoint is restricted to ADMIN", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, AdminAuditLogController), ["ADMIN"]);
});
