import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { assertPasswordPolicy, isPasswordPolicyCompliant } from "./password-policy";

void test("shared password policy accepts a strong password", () => {
  assert.equal(isPasswordPolicyCompliant("Strong-password-1234!"), true);
  assert.doesNotThrow(() => assertPasswordPolicy("Strong-password-1234!"));
});

void test("shared password policy rejects missing requirements", () => {
  for (const password of ["short", "alllowercasepassword1!", "ALLUPPERCASE123!", "NoNumberPassword!", "NoSpecialPassword123"]) {
    assert.equal(isPasswordPolicyCompliant(password), false, password);
    assert.throws(
      () => assertPasswordPolicy(password),
      (error: unknown) => error instanceof BadRequestException && error.getResponse().code === "PASSWORD_POLICY_VIOLATION",
    );
  }
});
