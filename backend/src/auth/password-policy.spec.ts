import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { assertPasswordPolicy, isPasswordPolicyCompliant } from "./password-policy";

void test("shared password policy accepts 8+ characters with a letter and number", () => {
  for (const password of ["oppo1234", "OPPO1234", "Strong-password-1234!", "โอปโป้1234"]) {
    assert.equal(isPasswordPolicyCompliant(password), true, password);
    assert.doesNotThrow(() => assertPasswordPolicy(password));
  }
});

void test("shared password policy rejects missing requirements", () => {
  for (const password of ["oppo123", "12345678", "oppopass", "!!!!!!!!"] ) {
    assert.equal(isPasswordPolicyCompliant(password), false, password);
    assert.throws(
      () => assertPasswordPolicy(password),
      (error: unknown) => error instanceof BadRequestException && error.getResponse().code === "PASSWORD_POLICY_VIOLATION",
    );
  }
});
