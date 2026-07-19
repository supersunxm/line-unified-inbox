import type { CookieOptions } from "express";

export function sessionCookieOptions(environment = process.env.NODE_ENV): CookieOptions {
  const production = environment === "production";
  return { httpOnly: true, secure: production, sameSite: production ? "none" : "lax", path: "/" };
}
