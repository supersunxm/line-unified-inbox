async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || "http://127.0.0.1:8765/oauth2callback";

  if (!clientId || !clientSecret) {
    console.error("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running this helper.");
    process.exit(1);
  }

  const code = process.argv[2]?.trim();
  if (!code) {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "https://www.googleapis.com/auth/drive");
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    console.log(`Open this URL, authorize the Drive account, then run this helper with the returned code:\n${url}`);
    process.exit(0);
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  });
  if (!response.ok) {
    console.error(`Google OAuth code exchange failed (${response.status}). Check the redirect URI and authorization code.`);
    process.exit(1);
  }
  const body = await response.json() as { refresh_token?: string };
  if (!body.refresh_token) {
    console.error("Google OAuth did not return a refresh token. Re-authorize with consent.");
    process.exit(1);
  }
console.log("Set GOOGLE_REFRESH_TOKEN in Railway to the following value (do not commit or expose it):");
console.log(body.refresh_token);
}

void main();
