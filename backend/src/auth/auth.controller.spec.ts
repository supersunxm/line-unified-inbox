import assert from "node:assert/strict";
import test from "node:test";
import { PATH_METADATA, METHOD_METADATA } from "@nestjs/common/constants";
import { RequestMethod } from "@nestjs/common";
import { IS_PUBLIC } from "./auth.decorators";
import { AuthController } from "./auth.controller";

void test("AuthController registers GET /auth/setup-status", () => {
  const handler = (AuthController.prototype as unknown as Record<string, unknown>).setupStatus;
  assert.equal(Reflect.getMetadata(PATH_METADATA, AuthController), "auth");
  assert.equal(Reflect.getMetadata(PATH_METADATA, handler as any), "setup-status");
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler as any), RequestMethod.GET);
});

void test("AuthController registers the PIN login and management routes", () => {
  const routes = [
    ["mobilePinLogin", "mobile/pin/login", RequestMethod.POST, true],
    ["setupPin", "mobile/pin/setup", RequestMethod.POST, false],
    ["changePin", "mobile/pin/change", RequestMethod.POST, false],
    ["resetPin", "mobile/pin/reset", RequestMethod.POST, false],
    ["disablePin", "mobile/pin/disable", RequestMethod.POST, false],
  ] as const;

  for (const [methodName, path, requestMethod, isPublic] of routes) {
    const handler = (AuthController.prototype as unknown as Record<string, unknown>)[methodName];
    assert.equal(Reflect.getMetadata(PATH_METADATA, handler as any), path);
    assert.equal(Reflect.getMetadata(METHOD_METADATA, handler as any), requestMethod);
    assert.equal(Reflect.getMetadata(IS_PUBLIC, handler as any), isPublic ? true : undefined);
  }
});
