"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  DEFAULT_TIKTOK_REDIRECT_URI,
  TIKTOK_OAUTH_STATE_COOKIE,
  TIKTOK_STATE_COOKIE_OPTIONS,
  buildTikTokAuthUrl,
  generateOAuthState,
} from "./tiktok-oauth";

export async function initiateTikTokOAuthAction() {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = process.env.TIKTOK_REDIRECT_URI || DEFAULT_TIKTOK_REDIRECT_URI;

  if (!clientKey) {
    throw new Error(
      "TikTok OAuth integration is not configured. Missing TIKTOK_CLIENT_KEY environment variable."
    );
  }

  const state = generateOAuthState();

  const cookieStore = await cookies();
  cookieStore.set(TIKTOK_OAUTH_STATE_COOKIE, state, TIKTOK_STATE_COOKIE_OPTIONS);

  const authUrl = buildTikTokAuthUrl({
    clientKey,
    redirectUri,
    state,
  });

  redirect(authUrl);
}
