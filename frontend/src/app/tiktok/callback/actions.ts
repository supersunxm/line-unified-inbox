"use server";

import { cookies } from "next/headers";
import { TIKTOK_OAUTH_STATE_COOKIE } from "../connect/tiktok-oauth";

export async function consumeTikTokOAuthStateAction() {
  const cookieStore = await cookies();
  cookieStore.set(TIKTOK_OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}
