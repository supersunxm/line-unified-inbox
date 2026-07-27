"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { FRIEND_ATTRIBUTION_TRANSLATIONS, FriendAttributionLocale } from "./friend-attribution-translations";
import { extractLiffIdFromUrl, extractSessionTokenFromUrl, isAttributionDebugEnabled } from "./friend-attribution-utils";

function getInitialAttributionState() {
  if (typeof window === "undefined") {
    return { lid: null, sessionToken: null, initialStep: "LOADING" as const };
  }
  const search = window.location.search;
  const lid = extractLiffIdFromUrl(search);
  const token = extractSessionTokenFromUrl(search);

  if (!lid) {
    return { lid: null, sessionToken: token, initialStep: "MISSING_CONFIG" as const };
  }
  if (!token) {
    return { lid, sessionToken: null, initialStep: "MISSING_TOKEN" as const };
  }
  return { lid, sessionToken: token, initialStep: "LOADING" as const };
}

export type LiffDiagnosticInfo = {
  operation: "requestFriendship";
  code: string;
  message: string;
  liffVersion: string | null;
  lineVersion: string | null;
  isInClient: boolean;
  isLoggedIn?: boolean;
  hasAccessToken?: boolean;
  hasIdToken?: boolean;
  currentPath?: string;
  entryMode?: string;
  sessionTokenRestored?: boolean;
  bootstrapStatus?: "Success" | "Failed" | "Skipped" | "Pending";
  initializedLiffId: string | null;
};

export function FriendAttributionView() {
  const [locale, setLocale] = useState<FriendAttributionLocale>("th");
  const [{ lid, sessionToken, initialStep }] = useState(getInitialAttributionState);
  const [step, setStep] = useState<
    | "LOADING"
    | "MISSING_CONFIG"
    | "MISSING_TOKEN"
    | "CONSENT"
    | "IDENTIFYING"
    | "CHECKING_FRIENDSHIP"
    | "ALREADY_FRIEND"
    | "PROMPT_ADD_FRIEND"
    | "WAITING_FOLLOW"
    | "CONFIRMED"
    | "ERROR"
  >(initialStep);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [diagnosticInfo, setDiagnosticInfo] = useState<LiffDiagnosticInfo | null>(null);
  const [, setIsFriend] = useState<boolean | null>(null);
  const [fallbackUrl, setFallbackUrl] = useState<string>(() => {
    const raw = process.env.NEXT_PUBLIC_FRIEND_ATTRIBUTION_FALLBACK_URL;
    if (raw && raw.trim()) return raw.trim();
    return "https://line.me/R/ti/p/@oppo_thailand";
  });

  const t = FRIEND_ATTRIBUTION_TRANSLATIONS[locale];
  const isDebugMode = isAttributionDebugEnabled();

  useEffect(() => {
    if (!lid || !sessionToken) return;
    const activeLid = lid;
    const activeSessionToken = sessionToken;

    let isSubscribed = true;

    async function initializeLiffAndBootstrap() {
      try {
        const liffModule = await import("@line/liff");
        const liff = liffModule.default;

        const isInClient = typeof liff.isInClient === "function" ? liff.isInClient() : false;
        const initOptions: { liffId: string; withLoginOnExternalBrowser?: boolean } = { liffId: activeLid };
        if (!isInClient) {
          initOptions.withLoginOnExternalBrowser = true;
        }

        await liff.init(initOptions);

        if (!isSubscribed) return;

        // Record safe booleans (NEVER expose token values)
        const isLoggedIn = typeof liff.isLoggedIn === "function" ? liff.isLoggedIn() : false;
        const hasAccessToken = Boolean(typeof liff.getAccessToken === "function" && liff.getAccessToken());
        const hasIdToken = Boolean(typeof liff.getIDToken === "function" && liff.getIDToken());
        const liffVersion = typeof liff.getVersion === "function" ? liff.getVersion() : null;
        const lineVersion = typeof liff.getLineVersion === "function" ? liff.getLineVersion() : null;
        const currentPath = typeof window !== "undefined" ? window.location.pathname : "N/A";
        const sessionTokenRestored = Boolean(activeSessionToken);

        const currentDiag: LiffDiagnosticInfo = {
          operation: "requestFriendship",
          code: "INITIALIZED",
          message: "LIFF SDK initialized successfully",
          liffVersion,
          lineVersion,
          isInClient,
          isLoggedIn,
          hasAccessToken,
          hasIdToken,
          currentPath,
          sessionTokenRestored,
          bootstrapStatus: "Pending",
          initializedLiffId: activeLid,
        };
        setDiagnosticInfo(currentDiag);

        // POST-INIT VERIFICATION: Call backend session status after liff.init resolves
        const bootstrap = await api.getFriendAttributionSessionStatus(activeSessionToken);
        if (!isSubscribed) return;

        if (bootstrap.fallbackUrl) {
          setFallbackUrl(bootstrap.fallbackUrl);
        }

        // Verify liffId match between link (lid) and backend session configuration
        if (bootstrap.liffId && bootstrap.liffId.trim() && bootstrap.liffId.trim() !== lid) {
          console.error(`LIFF ID mismatch: bootstrap returned '${bootstrap.liffId}' but page initialized '${lid}'`);
          setDiagnosticInfo((prev) => (prev ? { ...prev, code: "LIFF_ID_MISMATCH", bootstrapStatus: "Failed" } : prev));
          setErrorMsg(t.liffConfigError);
          setStep("ERROR");
          return;
        }

        if (bootstrap.status === "EXPIRED") {
          setDiagnosticInfo((prev) => (prev ? { ...prev, code: "SESSION_BOOTSTRAP_FAILED", bootstrapStatus: "Failed" } : prev));
          setErrorMsg(t.invalidSessionError);
          setStep("ERROR");
          return;
        }

        // ACCESS TOKEN & LOGIN GUARD
        if (isInClient) {
          if (!hasAccessToken) {
            console.error("LIFF in-client access token is missing");
            setDiagnosticInfo((prev) => (prev ? { ...prev, code: "LIFF_AUTH_MISSING", bootstrapStatus: "Failed" } : prev));
            setErrorMsg(t.customerErrorMessage);
            setStep("ERROR");
            return;
          }
          setDiagnosticInfo((prev) => (prev ? { ...prev, code: "BOOTSTRAP_SUCCESS", bootstrapStatus: "Success" } : prev));
          setStep("CONSENT");
        } else {
          if (!isLoggedIn) {
            liff.login({ redirectUri: window.location.href });
            return;
          }
          setDiagnosticInfo((prev) => (prev ? { ...prev, code: "BOOTSTRAP_SUCCESS", bootstrapStatus: "Success" } : prev));
          setStep("CONSENT");
        }
      } catch (err: unknown) {
        if (!isSubscribed) return;
        console.error("LIFF initialization error:", err);
        setDiagnosticInfo((prev) => (prev ? { ...prev, code: "SESSION_BOOTSTRAP_FAILED", bootstrapStatus: "Failed" } : prev));
        setErrorMsg(t.customerErrorMessage);
        setStep("ERROR");
      }
    }

    initializeLiffAndBootstrap();

    return () => {
      isSubscribed = false;
    };
  }, [lid, sessionToken, t.customerErrorMessage, t.invalidSessionError, t.liffConfigError]);

  const handleConsent = async () => {
    if (!lid || !sessionToken) return;

    try {
      setStep("IDENTIFYING");

      const liffModule = await import("@line/liff");
      const liff = liffModule.default;

      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      const idToken = liff.getIDToken();

      const identifyRes = await api.identifyFriendAttribution({
        sessionToken,
        idToken: idToken || undefined,
        consentGiven: true,
      });

      if (identifyRes.fallbackUrl) {
        setFallbackUrl(identifyRes.fallbackUrl);
      }

      setStep("CHECKING_FRIENDSHIP");
      const friendship = await liff.getFriendship();
      const isAlreadyFriend = Boolean(friendship?.friendFlag);
      setIsFriend(isAlreadyFriend);

      const statusRes = await api.updateFriendshipStatus({
        sessionToken,
        isFriend: isAlreadyFriend,
      });

      if (statusRes.fallbackUrl) {
        setFallbackUrl(statusRes.fallbackUrl);
      }

      if (isAlreadyFriend || statusRes.action === "ALREADY_FRIEND") {
        setStep("ALREADY_FRIEND");
      } else {
        setStep("PROMPT_ADD_FRIEND");
      }
    } catch (err: unknown) {
      console.error("LIFF Friend Attribution consent error:", err);
      setErrorMsg(t.customerErrorMessage);
      setStep("ERROR");
    }
  };

  const handleRequestFriendship = async () => {
    if (!sessionToken) return;

    setErrorMsg(null);
    setStep("WAITING_FOLLOW");

    try {
      const liffModule = await import("@line/liff");
      const liff = liffModule.default;

      const isInClient = typeof liff.isInClient === "function" ? liff.isInClient() : false;
      const isLoggedIn = typeof liff.isLoggedIn === "function" ? liff.isLoggedIn() : false;
      const hasAccessToken = Boolean(typeof liff.getAccessToken === "function" && liff.getAccessToken());
      const hasIdToken = Boolean(typeof liff.getIDToken === "function" && liff.getIDToken());
      const liffVersion = typeof liff.getVersion === "function" ? liff.getVersion() : null;
      const lineVersion = typeof liff.getLineVersion === "function" ? liff.getLineVersion() : null;

      // Access Token Guard: Stop if access token is absent inside LINE app
      if (isInClient && !hasAccessToken) {
        const diag: LiffDiagnosticInfo = {
          operation: "requestFriendship",
          code: "MISSING_ACCESS_TOKEN",
          message: "Access token is missing inside LINE client",
          liffVersion,
          lineVersion,
          isInClient,
          isLoggedIn,
          hasAccessToken,
          hasIdToken,
          initializedLiffId: lid,
        };
        console.error("LIFF Friend Attribution requestFriendship error:", diag);
        setDiagnosticInfo(diag);
        setErrorMsg(t.customerErrorMessage);
        setStep("PROMPT_ADD_FRIEND");
        return;
      }

      // Log getFriendship before calling requestFriendship
      const friendshipBefore = await liff.getFriendship().catch(() => null);
      console.log("LIFF getFriendship result before requestFriendship:", friendshipBefore);

      // Confirm liff.isInClient() === true and requestFriendship function availability before calling
      if (!isInClient || typeof liff.requestFriendship !== "function") {
        const diag: LiffDiagnosticInfo = {
          operation: "requestFriendship",
          code: !isInClient ? "NOT_IN_CLIENT" : "FUNCTION_NOT_FOUND",
          message: !isInClient
            ? "liff.requestFriendship requires running inside the LINE in-app browser"
            : "liff.requestFriendship function is not defined on LIFF SDK",
          liffVersion,
          lineVersion,
          isInClient,
          isLoggedIn,
          hasAccessToken,
          hasIdToken,
          initializedLiffId: lid,
        };
        console.error("LIFF Friend Attribution requestFriendship error:", diag);
        setDiagnosticInfo(diag);
        setErrorMsg(t.customerErrorMessage);
        setStep("PROMPT_ADD_FRIEND");
        return;
      }

      // Execute requestFriendship
      await liff.requestFriendship();

      // Re-check getFriendship AFTER requestFriendship resolves
      const friendshipAfter = await liff.getFriendship().catch(() => null);
      console.log("LIFF getFriendship result after requestFriendship:", friendshipAfter);
      const isFriendAfter = Boolean(friendshipAfter?.friendFlag);
      setIsFriend(isFriendAfter);

      // Update backend friendship status using actual friendFlag
      const statusRes = await api.updateFriendshipStatus({ sessionToken, isFriend: isFriendAfter });
      if (statusRes.fallbackUrl) {
        setFallbackUrl(statusRes.fallbackUrl);
      }

      if (isFriendAfter) {
        setStep("ALREADY_FRIEND");
        return;
      }

      // Poll session status for webhook follow confirmation
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const res = await api.getFriendAttributionSessionStatus(sessionToken);
          if (res.fallbackUrl) {
            setFallbackUrl(res.fallbackUrl);
          }
          if (res.confirmed) {
            clearInterval(pollInterval);
            setStep("CONFIRMED");
          } else if (attempts >= 10) {
            clearInterval(pollInterval);
            setStep("PROMPT_ADD_FRIEND");
          }
        } catch {
          if (attempts >= 10) clearInterval(pollInterval);
        }
      }, 2000);
    } catch (err: unknown) {
      const errObj = err as { code?: string | number; message?: string; name?: string };
      const liffModule = await import("@line/liff");
      const liff = liffModule.default;

      const code = errObj.code ? String(errObj.code) : errObj.name || "UNKNOWN_ERROR";
      const message = errObj.message || String(err);
      const liffVersion = typeof liff.getVersion === "function" ? liff.getVersion() : null;
      const lineVersion = typeof liff.getLineVersion === "function" ? liff.getLineVersion() : null;
      const isInClient = typeof liff.isInClient === "function" ? liff.isInClient() : false;
      const isLoggedIn = typeof liff.isLoggedIn === "function" ? liff.isLoggedIn() : false;
      const hasAccessToken = Boolean(typeof liff.getAccessToken === "function" && liff.getAccessToken());
      const hasIdToken = Boolean(typeof liff.getIDToken === "function" && liff.getIDToken());

      const diag: LiffDiagnosticInfo = {
        operation: "requestFriendship",
        code,
        message,
        liffVersion,
        lineVersion,
        isInClient,
        isLoggedIn,
        hasAccessToken,
        hasIdToken,
        initializedLiffId: lid,
      };

      console.error("LIFF Friend Attribution requestFriendship error:", diag);
      setDiagnosticInfo(diag);
      setErrorMsg(t.customerErrorMessage);
      setStep("PROMPT_ADD_FRIEND");
    }
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F8FAFC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ position: "absolute", top: "16px", right: "16px", display: "flex", gap: "8px" }}>
        {(["th", "en", "zh"] as const).map((loc) => (
          <button
            key={loc}
            onClick={() => setLocale(loc)}
            style={{
              padding: "4px 8px",
              borderRadius: "4px",
              border: "1px solid #CBD5E1",
              backgroundColor: locale === loc ? "#0284C7" : "#FFFFFF",
              color: locale === loc ? "#FFFFFF" : "#334155",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {loc.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ backgroundColor: "#FFFFFF", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.08)", padding: "24px", maxWidth: "420px", width: "100%", textAlign: "center" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "24px", backgroundColor: "#E0F2FE", color: "#0284C7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto", fontWeight: 700, fontSize: "20px" }}>
          OPPO
        </div>

        <h1 style={{ fontSize: "18px", fontWeight: 700, color: "#0F172A", marginBottom: "16px" }}>{t.pageTitle}</h1>

        {step === "LOADING" && (
          <div>
            <div style={{ width: "24px", height: "24px", border: "3px solid #E2E8F0", borderTopColor: "#06C755", borderRadius: "50%", margin: "0 auto 16px auto", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: "14px", color: "#475569" }}>{t.loading}</p>
          </div>
        )}

        {step === "MISSING_CONFIG" && (
          <div>
            <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "16px" }}>{t.liffConfigError}</p>
          </div>
        )}

        {step === "MISSING_TOKEN" && (
          <div>
            <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "16px" }}>{t.invalidSessionError}</p>
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", padding: "10px 16px", backgroundColor: "#06C755", color: "#FFFFFF", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "14px" }}
            >
              {t.fallbackBtn}
            </a>
          </div>
        )}

        {step === "CONSENT" && (
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#1E293B", marginBottom: "8px" }}>{t.consentTitle}</h2>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.5", marginBottom: "20px", textAlign: "left", backgroundColor: "#F1F5F9", padding: "12px", borderRadius: "8px" }}>
              {t.consentMessage}
            </p>
            <button
              onClick={handleConsent}
              style={{ width: "100%", padding: "12px", backgroundColor: "#06C755", color: "#FFFFFF", border: "none", borderRadius: "8px", fontWeight: 600, fontSize: "15px", cursor: "pointer" }}
            >
              {t.consentAgree}
            </button>
          </div>
        )}

        {(step === "IDENTIFYING" || step === "CHECKING_FRIENDSHIP") && (
          <div>
            <div style={{ width: "24px", height: "24px", border: "3px solid #E2E8F0", borderTopColor: "#06C755", borderRadius: "50%", margin: "0 auto 16px auto", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: "14px", color: "#475569" }}>{step === "IDENTIFYING" ? t.identifying : t.checkingFriendship}</p>
          </div>
        )}

        {step === "ALREADY_FRIEND" && (
          <div>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>🎉</div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#166534", marginBottom: "8px" }}>{t.alreadyFriendTitle}</h2>
            <p style={{ fontSize: "14px", color: "#475569", marginBottom: "20px" }}>{t.alreadyFriendDesc}</p>
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", width: "100%", padding: "12px", backgroundColor: "#06C755", color: "#FFFFFF", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "14px", boxSizing: "border-box" }}
            >
              {t.fallbackBtn}
            </a>
          </div>
        )}

        {step === "PROMPT_ADD_FRIEND" && (
          <div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0F172A", marginBottom: "8px" }}>{t.promptAddFriendTitle}</h2>
            <p style={{ fontSize: "14px", color: "#475569", marginBottom: "16px" }}>{errorMsg || t.promptAddFriendDesc}</p>

            {isDebugMode && diagnosticInfo && (
              <div
                id="liff-diagnostic-info"
                style={{
                  marginBottom: "16px",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  textAlign: "left",
                  fontSize: "12px",
                  color: "#991B1B",
                }}
              >
                <p style={{ fontWeight: 600, margin: "0 0 4px 0" }}>Diagnostic Info ({diagnosticInfo.code})</p>
                <div style={{ fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all", lineHeight: 1.4 }}>
                  <div>Build Marker: LIFF-ATTR-V3</div>
                  <div>Initialized LIFF ID: {diagnosticInfo.initializedLiffId || "N/A"}</div>
                  <div>In Client: {diagnosticInfo.isInClient ? "Yes" : "No"}</div>
                  <div>Is Logged In: {diagnosticInfo.isLoggedIn ? "Yes" : "No"}</div>
                  <div>Has Access Token: {diagnosticInfo.hasAccessToken ? "Yes" : "No"}</div>
                  <div>Has ID Token: {diagnosticInfo.hasIdToken ? "Yes" : "No"}</div>
                  <div>Current Path: {diagnosticInfo.currentPath || "N/A"}</div>
                  <div>Session Bootstrap: {diagnosticInfo.bootstrapStatus || "Failed"}</div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                id="liff-retry-add-friend-btn"
                onClick={handleRequestFriendship}
                style={{ width: "100%", padding: "12px", backgroundColor: "#06C755", color: "#FFFFFF", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "15px", cursor: "pointer", boxShadow: "0 2px 6px rgba(6,199,85,0.3)" }}
              >
                {diagnosticInfo ? t.retryAddFriendBtn : t.addFriendBtn}
              </button>

              <a
                id="liff-open-official-account-link"
                href={fallbackUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", width: "100%", padding: "10px", backgroundColor: "#F1F5F9", color: "#334155", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "14px", boxSizing: "border-box", border: "1px solid #CBD5E1" }}
              >
                {t.fallbackBtn}
              </a>
            </div>
          </div>
        )}

        {step === "WAITING_FOLLOW" && (
          <div>
            <div style={{ width: "24px", height: "24px", border: "3px solid #E2E8F0", borderTopColor: "#06C755", borderRadius: "50%", margin: "0 auto 16px auto", animation: "spin 1s linear infinite" }} />
            <p style={{ fontSize: "14px", color: "#475569", marginBottom: "16px" }}>{t.waitingFollow}</p>
          </div>
        )}

        {step === "CONFIRMED" && (
          <div>
            <div style={{ fontSize: "36px", marginBottom: "8px" }}>✅</div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#166534", marginBottom: "8px" }}>{t.confirmedTitle}</h2>
            <p style={{ fontSize: "14px", color: "#475569", marginBottom: "20px" }}>{t.confirmedDesc}</p>
            <a
              href={fallbackUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", width: "100%", padding: "12px", backgroundColor: "#06C755", color: "#FFFFFF", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "14px", boxSizing: "border-box" }}
            >
              {t.fallbackBtn}
            </a>
          </div>
        )}

        {step === "ERROR" && (
          <div>
            <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "16px" }}>{errorMsg || t.customerErrorMessage}</p>

            {isDebugMode && diagnosticInfo && (
              <div
                id="liff-diagnostic-info"
                style={{
                  marginBottom: "16px",
                  padding: "10px 12px",
                  borderRadius: "6px",
                  backgroundColor: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  textAlign: "left",
                  fontSize: "12px",
                  color: "#991B1B",
                }}
              >
                <p style={{ fontWeight: 600, margin: "0 0 4px 0" }}>Diagnostic Info ({diagnosticInfo.code})</p>
                <div style={{ fontFamily: "monospace", fontSize: "11px", wordBreak: "break-all", lineHeight: 1.4 }}>
                  <div>Initialized LIFF ID: {diagnosticInfo.initializedLiffId || "N/A"}</div>
                  <div>In Client: {diagnosticInfo.isInClient ? "Yes" : "No"}</div>
                  <div>Is Logged In: {diagnosticInfo.isLoggedIn ? "Yes" : "No"}</div>
                  <div>Has Access Token: {diagnosticInfo.hasAccessToken ? "Yes" : "No"}</div>
                  <div>Has ID Token: {diagnosticInfo.hasIdToken ? "Yes" : "No"}</div>
                  <div>Current Path: {diagnosticInfo.currentPath || "N/A"}</div>
                  <div>Session Bootstrap: {diagnosticInfo.bootstrapStatus || "Failed"}</div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                id="liff-retry-add-friend-btn"
                onClick={handleRequestFriendship}
                style={{ width: "100%", padding: "12px", backgroundColor: "#06C755", color: "#FFFFFF", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "15px", cursor: "pointer", boxShadow: "0 2px 6px rgba(6,199,85,0.3)" }}
              >
                {t.retryAddFriendBtn}
              </button>

              <a
                id="liff-open-official-account-link"
                href={fallbackUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: "block", width: "100%", padding: "10px", backgroundColor: "#F1F5F9", color: "#334155", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "14px", boxSizing: "border-box", border: "1px solid #CBD5E1" }}
              >
                {t.fallbackBtn}
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
