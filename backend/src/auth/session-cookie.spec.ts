import assert from "node:assert/strict";
import test from "node:test";
import { sessionCookieOptions } from "./session-cookie";

void test("production session cookie supports HTTPS cross-site pilot safely", () => {
  assert.deepEqual(sessionCookieOptions("production"), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
});

void test("development session cookie remains localhost compatible", () => {
  assert.deepEqual(sessionCookieOptions("development"), {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });
});

void test("session cookie preserves configured domain while keeping secure flags and path /", () => {
  process.env.SESSION_COOKIE_DOMAIN = ".lineoppo.click";
  try {
    assert.deepEqual(sessionCookieOptions("production"), {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      domain: ".lineoppo.click",
    });
  } finally {
    delete process.env.SESSION_COOKIE_DOMAIN;
  }
});
