import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { MobileApiExceptionFilter } from "./mobile-api-exception.filter";

function invoke(path: string, error: Error) {
  let statusCode: number | undefined;
  let body: unknown;
  const response = { status: (status: number) => { statusCode = status; return { json: (value: unknown) => { body = value; } }; } };
  const host = { switchToHttp: () => ({ getRequest: () => ({ path }), getResponse: () => response }) };
  new MobileApiExceptionFilter().catch(error, host as never);
  return { statusCode, body };
}

void test("mobile authentication and authorization errors use stable contract codes", () => {
  assert.deepEqual(invoke("/mobile/conversations", new UnauthorizedException()), { statusCode: 401, body: { statusCode: 401, code: "SESSION_EXPIRED", message: "Unauthorized" } });
  assert.deepEqual(invoke("/mobile/conversations/other", new ForbiddenException()), { statusCode: 403, body: { statusCode: 403, code: "ACCESS_DENIED", message: "Forbidden" } });
  assert.deepEqual(invoke("/mobile/conversations/missing", new NotFoundException()), { statusCode: 404, body: { statusCode: 404, code: "RESOURCE_NOT_FOUND", message: "Not Found" } });
});

void test("mobile filter preserves PASSWORD_CHANGE_REQUIRED authorization code", () => {
  assert.deepEqual(
    invoke("/mobile/conversations", new ForbiddenException({ code: "PASSWORD_CHANGE_REQUIRED", message: "Password change required" })),
    { statusCode: 403, body: { statusCode: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "Password change required" } },
  );
});
