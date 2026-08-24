import assert from "node:assert/strict";
import test from "node:test";
import "reflect-metadata";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { REQUIRED_ROLES } from "./auth.decorators";
import { AdminAuditLogController } from "./admin-audit-log.controller";
import { AdminRegistrationController } from "./admin-registration.controller";

void test("audit log endpoint is restricted to ADMIN", () => {
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, AdminAuditLogController), ["ADMIN"]);
});

void test("permanent account deletion is an ADMIN-only explicit action route", () => {
  const handler = AdminRegistrationController.prototype.permanentlyDelete;
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, AdminRegistrationController), ["ADMIN"]);
  assert.equal(Reflect.getMetadata(PATH_METADATA, handler), "users/:id/permanent-delete");
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), RequestMethod.POST);
});
