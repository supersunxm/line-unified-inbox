import type { CookieOptions } from "express";

export function sessionCookieOptions(environment = process.env.NODE_ENV): CookieOptions {
  const production = environment === "production";
  const domain = process.env.SESSION_COOKIE_DOMAIN?.trim() || process.env.COOKIE_DOMAIN?.trim() || undefined;
  const options: CookieOptions = {
    httpOnly: true,
    secure: production,
    sameSite: production ? "none" : "lax",
    path: "/",
  };
  if (domain) {
    options.domain = domain;
  }
  return options;
}
