import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "class-validator";
import { MobilePasswordLoginDto } from "./mobile-auth.dto";

void test("mobile password login accepts either an email or username identifier", async () => {
  const usernameLogin = Object.assign(new MobilePasswordLoginDto(), {
    email: "admin",
    password: "correct-password",
  });
  const emailLogin = Object.assign(new MobilePasswordLoginDto(), {
    email: "hq@example.test",
    password: "correct-password",
  });

  assert.deepEqual(await validate(usernameLogin), []);
  assert.deepEqual(await validate(emailLogin), []);
});

void test("mobile password login still rejects an empty identifier", async () => {
  const dto = Object.assign(new MobilePasswordLoginDto(), {
    email: "",
    password: "correct-password",
  });

  assert.ok((await validate(dto)).length > 0);
});
