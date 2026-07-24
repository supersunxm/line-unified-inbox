"use client";

import { useState } from "react";
import { api } from "../../lib/api";
import { FRIEND_ATTRIBUTION_TRANSLATIONS, FriendAttributionLocale } from "./friend-attribution-translations";
import { extractSessionTokenFromUrl } from "./friend-attribution-utils";

function getInitialAttributionState() {
  if (typeof window === "undefined") {
    return { liffId: null, sessionToken: null, initialStep: "LOADING" as const };
  }
  const liffId = process.env.NEXT_PUBLIC_FRIEND_ATTRIBUTION_LIFF_ID || null;
  if (!liffId) {
    return { liffId: null, sessionToken: null, initialStep: "MISSING_CONFIG" as const };
  }
  const token = extractSessionTokenFromUrl(window.location.search);
  if (!token) {
    return { liffId, sessionToken: null, initialStep: "MISSING_TOKEN" as const };
  }
  return { liffId, sessionToken: token, initialStep: "CONSENT" as const };
}

export function FriendAttributionView() {
  const [locale, setLocale] = useState<FriendAttributionLocale>("th");
  const [{ liffId, sessionToken, initialStep }] = useState(getInitialAttributionState);
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
  const [isFriend, setIsFriend] = useState<boolean | null>(null);

  const t = FRIEND_ATTRIBUTION_TRANSLATIONS[locale];

  const handleConsent = async () => {
    if (!liffId || !sessionToken) return;

    try {
      setStep("IDENTIFYING");

      const liffModule = await import("@line/liff");
      const liff = liffModule.default;

      await liff.init({ liffId });

      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      const idToken = liff.getIDToken();

      await api.identifyFriendAttribution({
        sessionToken,
        idToken: idToken || undefined,
        consentGiven: true,
      });

      setStep("CHECKING_FRIENDSHIP");
      const friendship = await liff.getFriendship();
      const isAlreadyFriend = Boolean(friendship?.friendFlag);
      setIsFriend(isAlreadyFriend);

      const statusRes = await api.updateFriendshipStatus({
        sessionToken,
        isFriend: isAlreadyFriend,
      });

      if (isAlreadyFriend || statusRes.action === "ALREADY_FRIEND") {
        setStep("ALREADY_FRIEND");
      } else {
        setStep("PROMPT_ADD_FRIEND");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setStep("ERROR");
    }
  };

  const handleRequestFriendship = async () => {
    if (!sessionToken) return;

    try {
      setStep("WAITING_FOLLOW");

      const liffModule = await import("@line/liff");
      const liff = liffModule.default;

      if (liff.isApiAvailable("requestFriendship")) {
        await liff.requestFriendship();
      }

      const friendship = await liff.getFriendship();
      if (friendship?.friendFlag) {
        setIsFriend(true);
        await api.updateFriendshipStatus({ sessionToken, isFriend: true });
      }

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const res = await api.getFriendAttributionSessionStatus(sessionToken);
          if (res.confirmed) {
            clearInterval(pollInterval);
            setStep("CONFIRMED");
          } else if (attempts >= 10) {
            clearInterval(pollInterval);
            setStep(isFriend ? "ALREADY_FRIEND" : "PROMPT_ADD_FRIEND");
          }
        } catch {
          if (attempts >= 10) clearInterval(pollInterval);
        }
      }, 2000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
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

        {step === "MISSING_CONFIG" && (
          <div>
            <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "16px" }}>{t.liffConfigError}</p>
          </div>
        )}

        {step === "MISSING_TOKEN" && (
          <div>
            <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "16px" }}>{t.invalidSessionError}</p>
            <a
              href="https://line.me/R/ti/p/@oppobsrbschonburi"
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
              href="https://line.me/R/ti/p/@oppobsrbschonburi"
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
            <p style={{ fontSize: "14px", color: "#475569", marginBottom: "20px" }}>{t.promptAddFriendDesc}</p>
            <button
              onClick={handleRequestFriendship}
              style={{ width: "100%", padding: "14px", backgroundColor: "#06C755", color: "#FFFFFF", border: "none", borderRadius: "8px", fontWeight: 700, fontSize: "16px", cursor: "pointer", boxShadow: "0 2px 6px rgba(6,199,85,0.3)" }}
            >
              {t.addFriendBtn}
            </button>
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
              href="https://line.me/R/ti/p/@oppobsrbschonburi"
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
            <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "16px" }}>{errorMsg || t.invalidSessionError}</p>
            <a
              href="https://line.me/R/ti/p/@oppobsrbschonburi"
              target="_blank"
              rel="noreferrer"
              style={{ display: "inline-block", width: "100%", padding: "12px", backgroundColor: "#06C755", color: "#FFFFFF", borderRadius: "8px", textDecoration: "none", fontWeight: 600, fontSize: "14px", boxSizing: "border-box" }}
            >
              {t.fallbackBtn}
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
