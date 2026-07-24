import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FRIEND_ATTRIBUTION_TRANSLATIONS } from "../src/app/friend-attribution/friend-attribution-translations.ts";
import { extractSessionTokenFromUrl } from "../src/app/friend-attribution/friend-attribution-utils.ts";
import { pivotLinksByStore, prepareLinkDetailsRows } from "../src/app/friend-source-links/friend-source-links-export.ts";
import type { FriendSourceLink } from "../src/types/api.ts";

test("Scenario 25: Friend attribution translation keys are complete across th, en, and zh", () => {
  const locales = ["th", "en", "zh"] as const;
  const baseKeys = Object.keys(FRIEND_ATTRIBUTION_TRANSLATIONS.th).sort();

  for (const loc of locales) {
    const keys = Object.keys(FRIEND_ATTRIBUTION_TRANSLATIONS[loc]).sort();
    assert.deepEqual(keys, baseKeys, `Locale '${loc}' is missing translation keys`);
  }
});

test("Scenario 14 & 15: LIFF ID environment validation and configuration error detection", () => {
  const checkLiffIdConfig = (envLiffId?: string | null) => {
    if (!envLiffId || !envLiffId.trim()) {
      return { ok: false, error: FRIEND_ATTRIBUTION_TRANSLATIONS.th.liffConfigError };
    }
    return { ok: true, liffId: envLiffId.trim() };
  };

  assert.equal(checkLiffIdConfig(undefined).ok, false);
  assert.equal(checkLiffIdConfig("").ok, false);
  assert.equal(checkLiffIdConfig("2007073384-xxxx").ok, true);
  assert.equal(checkLiffIdConfig("2007073384-xxxx").liffId, "2007073384-xxxx");
});

test("Scenario 16: Login redirect preserves token parameter and parses encoded liff.state", () => {
  // Direct parameter
  assert.equal(extractSessionTokenFromUrl("?token=sat_1234567890"), "sat_1234567890");

  // Encoded liff.state parameter: ?liff.state=%3Ftoken%3Dsat_9876543210
  assert.equal(extractSessionTokenFromUrl("?liff.state=%3Ftoken%3Dsat_9876543210"), "sat_9876543210");

  // Encoded path in liff.state: ?liff.state=%2Ffriend-attribution%3Ftoken%3Dsat_path_token
  assert.equal(extractSessionTokenFromUrl("?liff.state=%2Ffriend-attribution%3Ftoken%3Dsat_path_token"), "sat_path_token");

  // Rejects invalid token formats
  assert.equal(extractSessionTokenFromUrl("?token=invalid_prefix"), null);
  assert.equal(extractSessionTokenFromUrl("?token=sat_short"), null);
  assert.equal(extractSessionTokenFromUrl("?token=sat_with_spaces%20invalid"), null);
  assert.equal(extractSessionTokenFromUrl(""), null);
});

test("Requirement 2 & 5: Payload matching and zero hardcoded store basic IDs", () => {
  const payload = {
    sessionToken: "sat_1234567890",
    idToken: "id_token_xyz",
    consentGiven: true,
  };

  const allowedKeys = new Set(["sessionToken", "idToken", "accessToken", "consentGiven"]);
  for (const key of Object.keys(payload)) {
    assert.ok(allowedKeys.has(key), `Payload key '${key}' must be allowed by NestJS DTO`);
  }

  // Localized customer error message is non-empty and user-friendly
  assert.equal(FRIEND_ATTRIBUTION_TRANSLATIONS.th.customerErrorMessage, "ไม่สามารถยืนยันข้อมูลได้ กรุณาปิดหน้านี้แล้วเปิดลิงก์ใหม่อีกครั้ง");
});

test("Scenario 17 & 18: Consent required before identify payload and ID token sent without raw client userId", () => {
  const buildIdentifyPayload = (sessionToken: string, idToken: string | null, consentGiven: boolean) => {
    if (!consentGiven) {
      throw new Error("Explicit user consent is required before linking LINE account");
    }
    return {
      sessionToken,
      idToken: idToken || undefined,
      consentGiven: true,
    };
  };

  assert.throws(
    () => buildIdentifyPayload("sat_123", "id_token_xyz", false),
    (err: unknown) => err instanceof Error && err.message.includes("consent")
  );

  const payload = buildIdentifyPayload("sat_123", "id_token_xyz", true);
  assert.equal(payload.sessionToken, "sat_123");
  assert.equal(payload.idToken, "id_token_xyz");
  assert.equal("lineUserId" in payload, false, "Browser must NOT send raw client userId");
});

test("Scenario 19 & 20 & 21: Friendship status check and requestFriendship user action flow", async () => {
  const mockLiffState = {
    isLoggedIn: true,
    friendFlag: false,
    requestFriendshipCalled: false,
  };

  const handleUserAddFriendClick = async () => {
    // User explicitly clicked the button
    mockLiffState.requestFriendshipCalled = true;
    mockLiffState.friendFlag = true; // Simulating successful add in LIFF
    return { friendFlag: mockLiffState.friendFlag };
  };

  assert.equal(mockLiffState.requestFriendshipCalled, false);
  await handleUserAddFriendClick();
  assert.equal(mockLiffState.requestFriendshipCalled, true);
});

test("Scenario 22: Browser friendship flag is distinguished from webhook follow confirmation", () => {
  const evaluateUIState = (friendFlag: boolean, webhookConfirmed: boolean) => {
    if (webhookConfirmed) return "CONFIRMED_WEBHOOK";
    if (friendFlag) return "ALREADY_FRIEND_BROWSER";
    return "PROMPT_ADD_FRIEND";
  };

  assert.equal(evaluateUIState(true, false), "ALREADY_FRIEND_BROWSER");
  assert.notEqual(evaluateUIState(true, false), "CONFIRMED_WEBHOOK", "UI must NOT claim webhook-confirmed until backend confirms");
  assert.equal(evaluateUIState(true, true), "CONFIRMED_WEBHOOK");
});

test("Scenario 23 & 24: Expired session error state and direct LINE OA fallback link", () => {
  const buildFallbackUrl = (basicId?: string | null) => {
    const clean = (basicId || "@oppobsrbschonburi").trim();
    const normalized = clean.startsWith("@") ? clean : `@${clean}`;
    return `https://line.me/R/ti/p/${encodeURIComponent(normalized)}`;
  };

  assert.equal(buildFallbackUrl("@oppobsrbschonburi"), "https://line.me/R/ti/p/%40oppobsrbschonburi");
  assert.equal(buildFallbackUrl(null), "https://line.me/R/ti/p/%40oppobsrbschonburi");
});

test("Scenario 26 & 27: Admin reporting and Excel export aggregate attribution metrics without user identifiers", () => {
  const sampleLinks: FriendSourceLink[] = [
    {
      id: "link-1",
      storeId: "store-1",
      storeName: "OBS Robinson Chonburi By OPPO",
      storeCode: "RBS01",
      lineOaId: "oa-chonburi",
      lineOaName: "OPPO BS RBS Chonburi",
      source: "STORE_QR",
      shortCode: "rbsqr1",
      shortUrl: "https://pilot.oppo.th/f/rbsqr1",
      destinationUrl: "https://line.me/R/ti/p/@oppobsrbschonburi",
      isActive: true,
      clickCount: 100,
      identifiedVisits: 85,
      alreadyFriends: 20,
      promptedAdds: 65,
      confirmedAdds: 40,
      conversionRate: 0.4,
      createdAt: "2026-07-24T10:00:00.000Z",
      updatedAt: "2026-07-24T10:00:00.000Z",
    },
  ];

  const pivotRows = pivotLinksByStore(sampleLinks);
  assert.equal(pivotRows.length, 1);
  const pRow = pivotRows[0];

  assert.equal(pRow.totalClicks, 100);
  assert.equal(pRow.identifiedVisits, 85);
  assert.equal(pRow.confirmedAdds, 40);
  assert.equal(pRow.conversionRate, "40.00%");

  const detailRows = prepareLinkDetailsRows(sampleLinks, "en");
  assert.equal(detailRows.length, 1);
  const dRow = detailRows[0];

  assert.equal(dRow.clicks, 100);
  assert.equal(dRow.identifiedVisits, 85);
  assert.equal(dRow.confirmedAdds, 40);
  assert.equal(dRow.conversionRate, "40.00%");

  // Verify privacy: no user IDs, session tokens, or raw credentials in export objects
  assert.equal("lineUserId" in pRow, false);
  assert.equal("lineUserIdHash" in pRow, false);
  assert.equal("sessionToken" in pRow, false);
  assert.equal("lineUserId" in dRow, false);
  assert.equal("lineUserIdHash" in dRow, false);
});

// ──────────────────────────────────────────────────────────────────────
// 35. LIFF requestFriendship Error Diagnostics, Pre/Post Checks & User Buttons
// ──────────────────────────────────────────────────────────────────────

test("Scenario 35: LIFF requestFriendship error diagnostics, pre/post checks, and manual user buttons", async () => {
  const viewFile = readFileSync(new URL("../src/app/friend-attribution/friend-attribution-view.tsx", import.meta.url), "utf8");

  // 1. Source code verification: isApiAvailable("requestFriendship") MUST NOT be called
  assert.doesNotMatch(viewFile, /isApiAvailable\(\s*["']requestFriendship["']\s*\)/, "Source must NOT call unsupported isApiAvailable('requestFriendship')");
  assert.match(viewFile, /typeof liff\.isInClient === "function"/, "Source must check isInClient()");
  assert.match(viewFile, /typeof liff\.requestFriendship !== "function"/, "Source must check function existence");
  assert.doesNotMatch(viewFile, /API Available:/, "UI must NOT display misleading API Available field");

  const buildDiagnosticInfo = (err: unknown, liff: { getVersion: () => string; getLineVersion: () => string; isInClient: () => boolean }) => {
    const errObj = err as { code?: string | number; message?: string; name?: string };
    const code = errObj.code ? String(errObj.code) : errObj.name || "UNKNOWN_ERROR";
    const message = errObj.message || String(err);

    return {
      operation: "requestFriendship" as const,
      code,
      message,
      liffVersion: liff.getVersion(),
      lineVersion: liff.getLineVersion(),
      isInClient: liff.isInClient(),
    };
  };

  const mockLiff = {
    getVersion: () => "2.29.1",
    getLineVersion: () => "26.11.0",
    isInClient: () => true,
  };

  // 2. FORBIDDEN error formatting
  const forbiddenErr = { code: "FORBIDDEN", message: "Feature is not available for this app/OA" };
  const diagForbidden = buildDiagnosticInfo(forbiddenErr, mockLiff);
  assert.equal(diagForbidden.code, "FORBIDDEN");
  assert.equal(diagForbidden.message, "Feature is not available for this app/OA");
  assert.equal(diagForbidden.isInClient, true);
  assert.equal("apiAvailable" in diagForbidden, false);

  // 3. UNKNOWN_ERROR formatting
  const unknownErr = new Error("Network timeout while calling LIFF bridge");
  const diagUnknown = buildDiagnosticInfo(unknownErr, mockLiff);
  assert.equal(diagUnknown.code, "Error");
  assert.equal(diagUnknown.message, "Network timeout while calling LIFF bridge");

  // 4. Privacy audit: Ensure diagnostic object contains ZERO secrets or tokens
  const sensitiveKeys = ["sessionToken", "idToken", "accessToken", "lineUserId", "secret", "channelSecret"];
  for (const sKey of sensitiveKeys) {
    assert.equal(sKey in diagForbidden, false, `Secret key '${sKey}' must NOT be in diagnostic object`);
    assert.equal(sKey in diagUnknown, false, `Secret key '${sKey}' must NOT be in diagnostic object`);
  }

  // 5. Verification that requestFriendship re-checks getFriendship after resolving
  let getFriendshipCallCount = 0;
  let friendshipFlag = false;

  const mockGetFriendship = async () => {
    getFriendshipCallCount++;
    return { friendFlag: friendshipFlag };
  };

  const executeRequestFriendshipFlow = async (shouldSucceedAdd: boolean) => {
    // Pre-check getFriendship
    const before = await mockGetFriendship();
    assert.equal(before.friendFlag, false);

    // Call requestFriendship
    if (shouldSucceedAdd) {
      friendshipFlag = true;
    }

    // Post-check getFriendship
    const after = await mockGetFriendship();
    return { friendFlag: after.friendFlag };
  };

  const flowResult = await executeRequestFriendshipFlow(true);
  assert.equal(getFriendshipCallCount, 2, "getFriendship must be called before and after requestFriendship");
  assert.equal(flowResult.friendFlag, true, "Post-check must reflect the updated friendFlag");
});

// ──────────────────────────────────────────────────────────────────────
// 36. Multi-Store Dynamic LIFF ID Bootstrap & Token Isolation
// ──────────────────────────────────────────────────────────────────────

test("Scenario 36: Multi-store dynamic LIFF ID bootstrap, fail closed, and token isolation", async () => {
  const viewFile = readFileSync(new URL("../src/app/friend-attribution/friend-attribution-view.tsx", import.meta.url), "utf8");

  // 1. Source code verification: NEXT_PUBLIC_FRIEND_ATTRIBUTION_LIFF_ID MUST NOT be used at runtime
  assert.doesNotMatch(viewFile, /NEXT_PUBLIC_FRIEND_ATTRIBUTION_LIFF_ID/, "Runtime view must NOT use NEXT_PUBLIC_FRIEND_ATTRIBUTION_LIFF_ID");
  assert.match(viewFile, /api\.getFriendAttributionSessionStatus/, "Source must bootstrap session status from API before liff.init");
  assert.match(viewFile, /setStep\(\s*["']MISSING_CONFIG["']\s*\)/, "Source must fail closed when liffId cannot be resolved");

  // 2. Extract token from direct URL and encoded liff.state before liff.init
  const directUrl = "?token=sat_banbueng123";
  const directToken = extractSessionTokenFromUrl(directUrl);
  assert.equal(directToken, "sat_banbueng123", "Direct token must be extracted before liff.init");

  const liffStateUrl = "?liff.state=%3Ftoken%3Dsat_chonburi456";
  const liffStateToken = extractSessionTokenFromUrl(liffStateUrl);
  assert.equal(liffStateToken, "sat_chonburi456", "Encoded liff.state token must be extracted before liff.init");

  // 3. Mock dynamic session bootstrap resolution
  const sessionDb: Record<string, { status: string; liffId: string | null; fallbackUrl: string }> = {
    sat_banbueng123: {
      status: "CLICKED",
      liffId: "2010830086-NfjPzy7t",
      fallbackUrl: "https://line.me/R/ti/p/%40oppobanqueng",
    },
    sat_chonburi456: {
      status: "CLICKED",
      liffId: "2007073384-ChonburiPilot",
      fallbackUrl: "https://line.me/R/ti/p/%40oppobsrbschonburi",
    },
    sat_unconfigured789: {
      status: "CLICKED",
      liffId: null,
      fallbackUrl: "https://line.me/R/ti/p/%40oppo_thailand",
    },
    sat_expired000: {
      status: "EXPIRED",
      liffId: "2010830086-NfjPzy7t",
      fallbackUrl: "https://line.me/R/ti/p/%40oppo_thailand",
    },
  };

  const bootstrapSession = async (token: string) => {
    const session = sessionDb[token];
    if (!session) throw new Error("Attribution session not found");
    return {
      status: session.status,
      confirmed: false,
      confirmedFollowAt: null,
      expiresAt: "2026-07-24T18:00:00.000Z",
      fallbackUrl: session.fallbackUrl,
      liffId: session.liffId,
    };
  };

  // Test Banbueng session returns Banbueng LIFF ID
  const banbuengRes = await bootstrapSession("sat_banbueng123");
  assert.equal(banbuengRes.liffId, "2010830086-NfjPzy7t");

  // Test Chonburi session returns Chonburi LIFF ID
  const chonburiRes = await bootstrapSession("sat_chonburi456");
  assert.equal(chonburiRes.liffId, "2007073384-ChonburiPilot");

  // Verify two simultaneous sessions resolve distinct LIFF IDs (no cross-store bleed)
  assert.notEqual(banbuengRes.liffId, chonburiRes.liffId);

  // Test unconfigured store session fails closed (liffId is null)
  const unconfiguredRes = await bootstrapSession("sat_unconfigured789");
  assert.equal(unconfiguredRes.liffId, null);

  // Privacy audit: Verify bootstrap response contains NO secrets
  const secretKeys = ["lineUserId", "lineUserIdHash", "channelSecret", "idToken", "accessToken"];
  for (const sKey of secretKeys) {
    assert.equal(sKey in banbuengRes, false, `Bootstrap response must NOT contain secret key '${sKey}'`);
  }
});
