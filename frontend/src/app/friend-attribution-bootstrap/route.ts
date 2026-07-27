import { NextResponse } from "next/server";

export function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LINE Friend Attribution Bootstrap</title>
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #F8FAFC; color: #334155; }
    .card { background: #FFFFFF; border-radius: 12px; padding: 24px; max-width: 400px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #06C755; border-radius: 50%; margin: 0 auto 16px auto; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <p id="status">Initializing LINE Friend Attribution...</p>
  </div>
  <script>
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const lid = params.get("lid") || "";
        const hash = window.location.hash || "";

        // Record pre-init safe booleans (NO secret values)
        const hasLiffStateQuery = Boolean(params.get("liff.state") || params.get("state"));
        const hasCredentialFragment = Boolean(hash);
        const fragmentContainsAccessTokenKey = hash.includes("access_token");
        const fragmentContainsIdTokenKey = hash.includes("id_token");

        sessionStorage.setItem("oppo_liff_pre_diag", JSON.stringify({
          hasLiffStateQuery,
          hasCredentialFragment,
          fragmentContainsAccessTokenKey,
          fragmentContainsIdTokenKey,
          stage: "PRIMARY"
        }));

        if (lid) {
          // Pre-hydration first-stage liff.init on exact Endpoint URL before React/Next.js bundle
          await liff.init({ liffId: lid });

          sessionStorage.setItem("oppo_liff_init_state", JSON.stringify({
            initializedLiffId: liff.id || lid,
            isInClient: liff.isInClient(),
            isLoggedIn: liff.isLoggedIn(),
            hasAccessToken: Boolean(liff.getAccessToken()),
            hasIdToken: Boolean(liff.getIDToken()),
            liffVersion: typeof liff.getVersion === "function" ? liff.getVersion() : "2.29.1",
            lineVersion: typeof liff.getLineVersion === "function" ? liff.getLineVersion() : null,
            stage: "PRIMARY"
          }));
        }

        // Handoff to lower-level sub-path: /friend-attribution-bootstrap/app
        const targetPath = "/friend-attribution-bootstrap/app" + window.location.search + window.location.hash;
        window.location.replace(targetPath);
      } catch (err) {
        console.error("Pre-hydration LIFF init error:", err);
        const targetPath = "/friend-attribution-bootstrap/app" + window.location.search + window.location.hash;
        window.location.replace(targetPath);
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
