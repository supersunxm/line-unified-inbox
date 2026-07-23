import assert from "node:assert/strict";
import test from "node:test";
import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { AuthController } from "./auth.controller";

void test("AuthController registers GET /auth/setup-status", () => {
  const handler = (AuthController.prototype as unknown as Record<string, unknown>).setupStatus;
  assert.equal(Reflect.getMetadata(PATH_METADATA, AuthController), "auth");
  assert.equal(Reflect.getMetadata(PATH_METADATA, handler as any), "setup-status");
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler as any), RequestMethod.GET);
});
