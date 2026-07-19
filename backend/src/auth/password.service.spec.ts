import assert from "node:assert/strict";
import test from "node:test";
import { PasswordService } from "./password.service";

void test("password hashing verifies the correct password without storing plaintext", async () => {
  const service = new PasswordService(); const hash = await service.hash("a-long-pilot-password");
  assert.equal(hash.includes("a-long-pilot-password"), false);
  assert.equal(await service.verify("a-long-pilot-password", hash), true);
});

void test("password verification rejects an invalid password", async () => {
  const service = new PasswordService(); const hash = await service.hash("a-long-pilot-password");
  assert.equal(await service.verify("incorrect-password", hash), false);
});
