import { NextResponse } from "next/server";
import { API_BASE_URL } from "../../lib/runtime-config";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  const backendOrigin = API_BASE_URL;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Add LINE Official Account | OPPO Unified Inbox</title>
  <script src="https://static.line-scdn.net/liff/edge/2/sdk.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 16px; background-color: #F8FAFC; color: #334155; }
    .lang-switcher { position: absolute; top: 16px; right: 16px; display: flex; gap: 8px; }
    .lang-btn { padding: 4px 8px; border-radius: 4px; border: 1px solid #CBD5E1; background-color: #FFFFFF; color: #334155; cursor: pointer; font-size: 12px; font-weight: 600; }
    .lang-btn.active { background-color: #0284C7; color: #FFFFFF; border-color: #0284C7; }
    .card { background: #FFFFFF; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); padding: 24px; max-width: 440px; width: 100%; text-align: center; }
    .logo-badge { width: 48px; height: 48px; border-radius: 24px; background-color: #E0F2FE; color: #0284C7; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-weight: 700; font-size: 20px; }
    .title { font-size: 18px; font-weight: 700; color: #0F172A; margin: 0 0 16px 0; }
    .spinner { width: 24px; height: 24px; border: 3px solid #E2E8F0; border-top-color: #06C755; border-radius: 50%; margin: 0 auto 16px auto; animation: spin 1s linear infinite; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .btn-primary { width: 100%; padding: 12px; background-color: #06C755; color: #FFFFFF; border: none; border-radius: 8px; font-weight: 700; font-size: 15px; cursor: pointer; box-shadow: 0 2px 6px rgba(6,199,85,0.3); text-decoration: none; display: inline-block; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-secondary { display: block; width: 100%; padding: 10px; background-color: #F1F5F9; color: #334155; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: 1px solid #CBD5E1; }
    .diag-box { margin-top: 20px; padding: 10px 12px; border-radius: 6px; background-color: #FEF2F2; border: 1px solid #FCA5A5; text-align: left; font-size: 12px; color: #991B1B; word-break: break-all; }
    .diag-title { font-weight: 600; margin: 0 0 4px 0; }
    .diag-content { font-family: monospace; font-size: 11px; line-height: 1.4; }
    .error-msg { color: #DC2626; font-size: 14px; margin-bottom: 16px; }
    .success-icon { font-size: 36px; margin-bottom: 8px; }
  </style>
</head>
<body>
  <div class="lang-switcher">
    <button class="lang-btn active" onclick="setLang('th')">TH</button>
    <button class="lang-btn" onclick="setLang('en')">EN</button>
    <button class="lang-btn" onclick="setLang('zh')">ZH</button>
  </div>

  <div class="card">
    <div class="logo-badge">OPPO</div>
    <h1 class="title" id="page-title">เพิ่มเพื่อน LINE Official Account</h1>

    <div id="app-content">
      <div class="spinner"></div>
      <p id="loading-msg" style="font-size:14px; color:#475569;">กำลังโหลด...</p>
    </div>

    <div id="diag-panel" class="diag-box" style="display:none;">
      <p class="diag-title">Diagnostic Info (<span id="diag-code">INITIALIZED</span>)</p>
      <div class="diag-content">
        <div>Build Marker: <span id="diag-build-marker">LIFF-ATTR-V3</span></div>
        <div>Initialized LIFF ID: <span id="diag-liff-id">N/A</span></div>
        <div>Current Path: <span id="diag-current-path">N/A</span></div>
        <div>Entry Mode: <span id="diag-entry-mode">UNKNOWN</span></div>
        <div>Pre-Init Has LIFF State: <span id="diag-pre-liff-state">No</span></div>
        <div>Pre-Init Has Fragment: <span id="diag-pre-fragment">No</span></div>
        <div>Fragment Keys (Access/ID/Context/Client): <span id="diag-frag-keys">No / No / No / No</span></div>
        <div>In Client: <span id="diag-in-client">No</span></div>
        <div>Is Logged In: <span id="diag-logged-in">No</span></div>
        <div>Has Access Token: <span id="diag-has-access">No</span></div>
        <div>Has ID Token: <span id="diag-has-id">No</span></div>
        <div>Session Token Restored: <span id="diag-token-restored">No</span></div>
        <div>Bootstrap Request Host: <span id="diag-bootstrap-host">BACKEND</span></div>
        <div>Bootstrap HTTP Status: <span id="diag-bootstrap-status-code">N/A</span></div>
        <div>Session Bootstrap: <span id="diag-bootstrap-status">Skipped</span></div>
      </div>
    </div>
  </div>

  <script>
    window.oppoBackendOrigin = "${backendOrigin}";
    window.oppoFallbackUrl = "https://line.me/R/ti/p/@oppo_thailand";
    window.currentLocale = "th";
    let autoRedirectTimer = null;
    let isRequestingFriendship = false;

    const translations = {
      th: {
        pageTitle: "เพิ่มเพื่อน LINE Official Account",
        loading: "กำลังโหลด...",
        addFriendBtn: "เพิ่มเพื่อน LINE OA",
        alreadyFriendTitle: "คุณเป็นเพื่อนกับเราแล้ว",
        alreadyFriendDesc: "กำลังเปิดหน้า LINE Official Account...",
        confirmedTitle: "เพิ่มเพื่อนสำเร็จ",
        confirmedDesc: "กำลังเปิดหน้า LINE Official Account...",
        fallbackBtn: "เปิด LINE Official Account",
        customerErrorMessage: "เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง",
        liffConfigError: "ระบบยังไม่พร้อมใช้งานในขณะนี้ กรุณาลองใหม่อีกครั้ง",
        invalidSessionError: "ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง"
      },
      en: {
        pageTitle: "Add LINE Official Account",
        loading: "Loading...",
        addFriendBtn: "Add LINE Official Account",
        alreadyFriendTitle: "You are already our friend",
        alreadyFriendDesc: "Opening LINE Official Account...",
        confirmedTitle: "Friend Added Successfully",
        confirmedDesc: "Opening LINE Official Account...",
        fallbackBtn: "Open LINE Official Account",
        customerErrorMessage: "An error occurred. Please try again.",
        liffConfigError: "System is currently unavailable. Please try again.",
        invalidSessionError: "Link has expired or is invalid. Please try again."
      },
      zh: {
        pageTitle: "添加 LINE 官方账号",
        loading: "加载中...",
        addFriendBtn: "添加 LINE 官方账号",
        alreadyFriendTitle: "您已经是我们的好友",
        alreadyFriendDesc: "正在打开 LINE 官方账号...",
        confirmedTitle: "好友添加成功",
        confirmedDesc: "正在打开 LINE 官方账号...",
        fallbackBtn: "打开 LINE 官方账号",
        customerErrorMessage: "发生错误，请重试。",
        liffConfigError: "系统暂不可用，请重试。",
        invalidSessionError: "链接已过期或无效，请重试。"
      }
    };

    function setLang(lang) {
      window.currentLocale = lang;
      document.querySelectorAll(".lang-btn").forEach(btn => {
        btn.classList.toggle("active", btn.innerText.toLowerCase() === lang);
      });
      const t = translations[lang] || translations.th;
      if (window.currentRenderState) {
        window.currentRenderState();
      } else {
        document.getElementById("page-title").innerText = t.pageTitle;
      }
    }

    function isAttributionDebugEnabled(searchStr) {
      const p = new URLSearchParams(searchStr || "");
      if (p.get("debug") === "1") return true;

      const liffState = p.get("liff.state") || p.get("state");
      if (liffState) {
        try {
          const decoded = decodeURIComponent(liffState);
          const innerParams = new URLSearchParams(decoded.startsWith("?") ? decoded : "?" + decoded);
          if (innerParams.get("debug") === "1") return true;
        } catch {
          if (/[?&]debug=1(?:&|$)/.test(liffState)) return true;
        }
      }
      return false;
    }

    function extractSessionTokenFromUrl(searchStr) {
      const p = new URLSearchParams(searchStr || "");
      const direct = p.get("token") || p.get("sessionToken");
      if (direct) return direct;
      const liffState = p.get("liff.state") || p.get("state");
      if (liffState) {
        try {
          const decoded = decodeURIComponent(liffState);
          const innerParams = new URLSearchParams(decoded.startsWith("?") ? decoded : "?" + decoded);
          return innerParams.get("token") || innerParams.get("sessionToken");
        } catch {
          const match = liffState.match(/[?&]token=([^&]+)/);
          if (match) return decodeURIComponent(match[1]);
        }
      }
      return null;
    }

    function deriveEntryMode(preDiag, sessionTokenRestored, hasLiffAuth) {
      if (sessionTokenRestored) {
        return "LIFF_WITH_ADDITIONAL_INFO";
      }
      if (hasLiffAuth || preDiag.hasLiffStateQuery || preDiag.hasUrlFragment) {
        return "DIRECT_LIFF";
      }
      return "ENDPOINT_DIRECT";
    }

    function updateDiag(data) {
      const isDebug = isAttributionDebugEnabled(window.location.search);
      const panel = document.getElementById("diag-panel");
      if (!panel) return;
      if (!isDebug) {
        panel.style.display = "none";
        return;
      }
      panel.style.display = "block";
      if (data.code) document.getElementById("diag-code").innerText = data.code;
      if (data.initializedLiffId !== undefined) document.getElementById("diag-liff-id").innerText = data.initializedLiffId || "N/A";
      document.getElementById("diag-current-path").innerText = window.location.pathname || "N/A";
      if (data.entryMode) document.getElementById("diag-entry-mode").innerText = data.entryMode;
      if (data.hasLiffStateQuery !== undefined) document.getElementById("diag-pre-liff-state").innerText = data.hasLiffStateQuery ? "Yes" : "No";
      if (data.hasUrlFragment !== undefined) document.getElementById("diag-pre-fragment").innerText = data.hasUrlFragment ? "Yes" : "No";
      if (data.fragKeys) document.getElementById("diag-frag-keys").innerText = data.fragKeys;
      if (data.isInClient !== undefined) document.getElementById("diag-in-client").innerText = data.isInClient ? "Yes" : "No";
      if (data.isLoggedIn !== undefined) document.getElementById("diag-logged-in").innerText = data.isLoggedIn ? "Yes" : "No";
      if (data.hasAccessToken !== undefined) document.getElementById("diag-has-access").innerText = data.hasAccessToken ? "Yes" : "No";
      if (data.hasIdToken !== undefined) document.getElementById("diag-has-id").innerText = data.hasIdToken ? "Yes" : "No";
      if (data.sessionTokenRestored !== undefined) document.getElementById("diag-token-restored").innerText = data.sessionTokenRestored ? "Yes" : "No";
      if (data.bootstrapHost) document.getElementById("diag-bootstrap-host").innerText = data.bootstrapHost;
      if (data.bootstrapStatusCode !== undefined) document.getElementById("diag-bootstrap-status-code").innerText = String(data.bootstrapStatusCode);
      if (data.bootstrapStatus !== undefined) document.getElementById("diag-bootstrap-status").innerText = data.bootstrapStatus;
    }

    function isValidFallbackUrl(url) {
      if (!url || typeof url !== "string") return false;
      try {
        const p = new URL(url);
        return (p.protocol === "https:" || p.protocol === "http:") &&
               (p.hostname.includes("line.me") || p.hostname.includes("line-official-account"));
      } catch {
        return false;
      }
    }

    function scheduleAutoRedirect(url) {
      const isDebug = isAttributionDebugEnabled(window.location.search);
      if (isDebug) return; // Disabled in debug=1 mode
      if (autoRedirectTimer) return; // Prevent duplicate timers
      if (!isValidFallbackUrl(url)) return;

      autoRedirectTimer = setTimeout(() => {
        autoRedirectTimer = null;
        if (isValidFallbackUrl(url)) {
          window.location.replace(url);
        }
      }, 1000);
    }

    function handleManualFallbackClick(e) {
      if (e) e.preventDefault();
      if (autoRedirectTimer) {
        clearTimeout(autoRedirectTimer);
        autoRedirectTimer = null;
      }
      if (isValidFallbackUrl(window.oppoFallbackUrl)) {
        window.location.replace(window.oppoFallbackUrl);
      }
    }

    function renderError(msgKeyOrText) {
      const t = translations[window.currentLocale] || translations.th;
      const text = t[msgKeyOrText] || msgKeyOrText || t.customerErrorMessage;
      window.currentRenderState = () => renderError(msgKeyOrText);
      document.getElementById("page-title").innerText = t.pageTitle;

      document.getElementById("app-content").innerHTML = \`
        <p class="error-msg">\${text}</p>
        <a href="#" onclick="handleManualFallbackClick(event)" class="btn-secondary">\${t.fallbackBtn}</a>
      \`;
    }

    function renderAlreadyFriend() {
      const t = translations[window.currentLocale] || translations.th;
      window.currentRenderState = renderAlreadyFriend;
      document.getElementById("page-title").innerText = t.alreadyFriendTitle;

      document.getElementById("app-content").innerHTML = \`
        <div class="success-icon">✅</div>
        <p style="font-size:14px; color:#475569; margin:0 0 20px 0;">\${t.alreadyFriendDesc}</p>
        <a href="#" onclick="handleManualFallbackClick(event)" class="btn-primary">\${t.fallbackBtn}</a>
      \`;

      scheduleAutoRedirect(window.oppoFallbackUrl);
    }

    function renderPromptAddFriend() {
      const t = translations[window.currentLocale] || translations.th;
      window.currentRenderState = renderPromptAddFriend;
      document.getElementById("page-title").innerText = t.promptAddFriendTitle;

      document.getElementById("app-content").innerHTML = \`
        <div style="display:flex; flex-direction:column; gap:10px;">
          <p style="font-size:14px; color:#475569; margin:0 0 12px 0;">\${t.promptAddFriendDesc}</p>
          <button id="liff-add-friend-btn" class="btn-primary" onclick="handleUserRequestFriendship()">\${t.addFriendBtn}</button>
          <a href="#" onclick="handleManualFallbackClick(event)" class="btn-secondary">\${t.fallbackBtn}</a>
        </div>
      \`;
    }

    function renderConfirmed() {
      const t = translations[window.currentLocale] || translations.th;
      window.currentRenderState = renderConfirmed;
      document.getElementById("page-title").innerText = t.confirmedTitle;

      document.getElementById("app-content").innerHTML = \`
        <div class="success-icon">✅</div>
        <p style="font-size:14px; color:#475569; margin:0 0 20px 0;">\${t.confirmedDesc}</p>
        <a href="#" onclick="handleManualFallbackClick(event)" class="btn-primary">\${t.fallbackBtn}</a>
      \`;

      scheduleAutoRedirect(window.oppoFallbackUrl);
    }

    async function handleUserRequestFriendship() {
      if (isRequestingFriendship) return;
      isRequestingFriendship = true;

      const btn = document.getElementById("liff-add-friend-btn");
      if (btn) btn.disabled = true;

      try {
        // 1. Check friendship BEFORE calling requestFriendship
        if (typeof liff !== "undefined" && typeof liff.getFriendship === "function") {
          const checkBefore = await liff.getFriendship().catch(() => null);
          if (checkBefore && checkBefore.friendFlag) {
            isRequestingFriendship = false;
            renderAlreadyFriend();
            return;
          }
        }

        // 2. Call requestFriendship defensively
        if (typeof liff !== "undefined" && typeof liff.requestFriendship === "function") {
          await liff.requestFriendship().catch(() => null);
        }

        // 3. Re-check getFriendship AFTER requestFriendship resolves or rejects
        if (typeof liff !== "undefined" && typeof liff.getFriendship === "function") {
          const checkAfter = await liff.getFriendship().catch(() => null);
          if (checkAfter && checkAfter.friendFlag) {
            isRequestingFriendship = false;
            renderAlreadyFriend();
            return;
          }
        }

        // If still false, show recoverable error and restore button
        isRequestingFriendship = false;
        if (btn) btn.disabled = false;
        renderError("customerErrorMessage");
      } catch (err) {
        console.error("liff.requestFriendship error:", err);
        // Defensive check in catch block
        try {
          if (typeof liff !== "undefined" && typeof liff.getFriendship === "function") {
            const fallbackCheck = await liff.getFriendship().catch(() => null);
            if (fallbackCheck && fallbackCheck.friendFlag) {
              isRequestingFriendship = false;
              renderAlreadyFriend();
              return;
            }
          }
        } catch {
          // ignore
        }

        isRequestingFriendship = false;
        if (btn) btn.disabled = false;
        renderError("customerErrorMessage");
      }
    }

    (async () => {
      // 1. PRE-INIT DIAGNOSTICS (Booleans only - NO raw credential data or tokens)
      const search = window.location.search || "";
      const hash = window.location.hash || "";
      const params = new URLSearchParams(search);

      const preDiag = {
        pathname: window.location.pathname,
        hasLiffStateQuery: Boolean(params.get("liff.state") || params.get("state")),
        hasUrlFragment: Boolean(hash),
        fragmentHasAccessTokenKey: hash.includes("access_token"),
        fragmentHasIdTokenKey: hash.includes("id_token"),
        fragmentHasContextTokenKey: hash.includes("context_token") || hash.includes("context"),
        fragmentHasClientIdKey: hash.includes("client_id"),
        endpointLiffIdPresent: Boolean(params.get("lid"))
      };

      const fragKeysStr = \`\${preDiag.fragmentHasAccessTokenKey ? "Yes" : "No"} / \${preDiag.fragmentHasIdTokenKey ? "Yes" : "No"} / \${preDiag.fragmentHasContextTokenKey ? "Yes" : "No"} / \${preDiag.fragmentHasClientIdKey ? "Yes" : "No"}\`;
      const lid = params.get("lid") || "";

      if (!lid) {
        renderError("liffConfigError");
        updateDiag({
          code: "LIFF_CONFIG_MISSING",
          initializedLiffId: "N/A",
          entryMode: deriveEntryMode(preDiag, false, false),
          hasLiffStateQuery: preDiag.hasLiffStateQuery,
          hasUrlFragment: preDiag.hasUrlFragment,
          fragKeys: fragKeysStr,
          bootstrapHost: "BACKEND",
          bootstrapStatusCode: "N/A",
          bootstrapStatus: "Failed"
        });
        return;
      }

      // 2. STANDARD LIFF LIFECYCLE: Call liff.init on document load BEFORE backend fetch
      try {
        await liff.init({ liffId: lid });
      } catch (err) {
        console.error("LIFF initialization error:", err);
        renderError("customerErrorMessage");
        updateDiag({
          code: "LIFF_INIT_FAILED",
          initializedLiffId: lid,
          entryMode: deriveEntryMode(preDiag, false, false),
          hasLiffStateQuery: preDiag.hasLiffStateQuery,
          hasUrlFragment: preDiag.hasUrlFragment,
          fragKeys: fragKeysStr,
          bootstrapHost: "BACKEND",
          bootstrapStatusCode: "N/A",
          bootstrapStatus: "Failed"
        });
        return;
      }

      // 3. POST-INIT DIAGNOSTICS (Booleans only)
      const isInClient = typeof liff.isInClient === "function" ? liff.isInClient() : false;
      const isLoggedIn = typeof liff.isLoggedIn === "function" ? liff.isLoggedIn() : false;
      const hasAccessToken = Boolean(typeof liff.getAccessToken === "function" && liff.getAccessToken());
      const hasIdToken = Boolean(typeof liff.getIDToken === "function" && liff.getIDToken());
      const hasLiffAuth = isInClient ? hasAccessToken : isLoggedIn;

      // 4. READ RESTORED SESSION TOKEN ONLY AFTER LIFF.INIT RESOLVES
      const sessionToken = extractSessionTokenFromUrl(window.location.search);
      const sessionTokenRestored = Boolean(sessionToken);
      const entryMode = deriveEntryMode(preDiag, sessionTokenRestored, hasLiffAuth);

      updateDiag({
        code: "INITIALIZED",
        initializedLiffId: liff.id || lid,
        entryMode,
        hasLiffStateQuery: preDiag.hasLiffStateQuery,
        hasUrlFragment: preDiag.hasUrlFragment,
        fragKeys: fragKeysStr,
        isInClient,
        isLoggedIn,
        hasAccessToken,
        hasIdToken,
        sessionTokenRestored,
        bootstrapHost: "BACKEND",
        bootstrapStatusCode: "N/A",
        bootstrapStatus: sessionTokenRestored ? "Pending" : "Skipped"
      });

      if (!sessionTokenRestored) {
        // Customer-facing failure: invalid/missing link
        renderError("invalidSessionError");
        updateDiag({ code: "ATTRIBUTION_TOKEN_MISSING", bootstrapStatus: "Failed" });
        return;
      }

      // 5. CALL BACKEND PUBLIC CONTROLLER (/friend-attribution/session-status?token=...) USING CONFIGURED BACKEND ORIGIN
      const statusUrl = new URL("/friend-attribution/session-status", window.oppoBackendOrigin);
      statusUrl.searchParams.set("token", sessionToken);

      let statusRes;
      try {
        statusRes = await fetch(statusUrl.toString(), {
          method: "GET",
          headers: { "Accept": "application/json" }
        });
      } catch (err) {
        console.error("Attribution session status network error:", err);
        renderError("customerErrorMessage");
        updateDiag({
          code: "SESSION_BOOTSTRAP_FAILED",
          bootstrapHost: "BACKEND",
          bootstrapStatusCode: "N/A",
          bootstrapStatus: "Failed"
        });
        return;
      }

      updateDiag({
        bootstrapHost: "BACKEND",
        bootstrapStatusCode: statusRes.status
      });

      if (!statusRes.ok) {
        renderError("invalidSessionError");
        const code = statusRes.status === 401 ? "UNAUTHORIZED_TOKEN"
          : statusRes.status === 404 ? "ATTRIBUTION_SESSION_NOT_FOUND"
          : statusRes.status === 410 ? "SESSION_EXPIRED"
          : "SESSION_BOOTSTRAP_FAILED";
        updateDiag({ code, bootstrapStatus: "Failed" });
        return;
      }

      const bootstrap = await statusRes.json();

      if (bootstrap.fallbackUrl && isValidFallbackUrl(bootstrap.fallbackUrl)) {
        window.oppoFallbackUrl = bootstrap.fallbackUrl;
      }

      // Customer-facing failure: configuration error
      if (bootstrap.liffId && bootstrap.liffId.trim() && bootstrap.liffId.trim() !== lid) {
        console.error(\`LIFF ID mismatch: bootstrap returned '\${bootstrap.liffId}' but page initialized '\${lid}'\`);
        renderError("liffConfigError");
        updateDiag({ code: "LIFF_ID_MISMATCH", bootstrapStatus: "Failed" });
        return;
      }

      if (bootstrap.status === "EXPIRED") {
        renderError("invalidSessionError");
        updateDiag({ code: "SESSION_EXPIRED", bootstrapStatus: "Failed" });
        return;
      }

      // Access Token & Login Guard
      if (isInClient) {
        if (!hasAccessToken) {
          console.error("LIFF in-client access token is missing");
          renderError("customerErrorMessage");
          updateDiag({ code: "LIFF_AUTH_MISSING", bootstrapStatus: "Failed" });
          return;
        }
      } else {
        if (!isLoggedIn) {
          liff.login({ redirectUri: window.location.href });
          return;
        }
      }

      updateDiag({ code: "BOOTSTRAP_SUCCESS", bootstrapStatus: "Success" });

      // 6. Identity verification & friendship check using configured backend origin
      const idToken = liff.getIDToken();
      const identifyUrl = new URL("/friend-attribution/identify", window.oppoBackendOrigin);
      await fetch(identifyUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, idToken: idToken || undefined, consentGiven: true })
      });

      const friendship = await liff.getFriendship().catch(() => ({ friendFlag: false }));
      const isAlreadyFriend = Boolean(friendship && friendship.friendFlag);

      const friendshipUrl = new URL("/friend-attribution/friendship-status", window.oppoBackendOrigin);
      await fetch(friendshipUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionToken, isFriend: isAlreadyFriend })
      });

      if (isAlreadyFriend) {
        updateDiag({ code: "ALREADY_FRIEND", bootstrapStatus: "Success" });
        renderAlreadyFriend();
      } else {
        renderPromptAddFriend();
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "CDN-Cache-Control": "no-store",
      "Surrogate-Control": "no-store",
    },
  });
}
