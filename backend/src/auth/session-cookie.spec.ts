import assert from "node:assert/strict";
import test from "node:test";
import { sessionCookieOptions } from "./session-cookie";

void test("production session cookie supports HTTPS cross-site pilot safely", () => assert.deepEqual(sessionCookieOptions("production"), { httpOnly: true, secure: true, sameSite: "none", path: "/" }));
void test("development session cookie remains localhost compatible", () => assert.deepEqual(sessionCookieOptions("development"), { httpOnly: true, secure: false, sameSite: "lax", path: "/" }));
