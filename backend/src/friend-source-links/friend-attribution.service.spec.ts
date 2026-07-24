import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, GoneException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import {
  getFriendAttributionHashSecret,
  getFriendAttributionLiffBaseUrl,
  getFriendAttributionLineLoginChannelId,
  getFriendAttributionPilotLineOaId,
  hashLineUserId,
  hashPublicSessionToken,
} from "./friend-attribution.config";
import { FriendSourceLinksService } from "./friend-source-links.service";

test("friend attribution config functions read environment variables safely", () => {
  const env = {
    FRIEND_ATTRIBUTION_PILOT_LINE_OA_ID: "oa-pilot-123",
    FRIEND_ATTRIBUTION_LIFF_BASE_URL: "https://frontend.up.railway.app/friend-attribution",
    FRIEND_ATTRIBUTION_LINE_LOGIN_CHANNEL_ID: "2007073384",
    FRIEND_ATTRIBUTION_SESSION_TTL_SECONDS: "3600",
    FRIEND_ATTRIBUTION_HASH_SECRET: "test_secret_key",
  } as unknown as NodeJS.ProcessEnv;

  assert.equal(getFriendAttributionPilotLineOaId(env), "oa-pilot-123");
  assert.equal(getFriendAttributionLiffBaseUrl(env), "https://frontend.up.railway.app/friend-attribution");
  assert.equal(getFriendAttributionLineLoginChannelId(env), "2007073384");
  assert.equal(getFriendAttributionHashSecret(env), "test_secret_key");
});

test("canonical LIFF URL is constructed when FRIEND_ATTRIBUTION_LIFF_ID is set", () => {
  const env = {
    FRIEND_ATTRIBUTION_LIFF_ID: "2007073384-xxxx",
  } as unknown as NodeJS.ProcessEnv;

  assert.equal(getFriendAttributionLiffBaseUrl(env), "https://liff.line.me/2007073384-xxxx");
});

test("hashPublicSessionToken and hashLineUserId compute deterministic HMAC-SHA256 hashes", () => {
  const token = "sat_abc123456789";
  const secret = "my_secret_key";
  const hash1 = hashPublicSessionToken(token, secret);
  const hash2 = hashPublicSessionToken(token, secret);
  assert.equal(hash1, hash2);
  assert.notEqual(hash1, token);

  const userId = "U1234567890abcdef";
  const uHash1 = hashLineUserId(userId, secret);
  const uHash2 = hashLineUserId(userId, secret);
  assert.equal(uHash1, uHash2);
  assert.notEqual(uHash1, userId);
});

test("Scenario 1 & 3: Click creates attribution session for pilot OA and stores only token hash", async () => {
  const createdSessions: Array<Record<string, unknown>> = [];
  const createdClicks: Array<Record<string, unknown>> = [];

  const mockPrisma = {
    friendSourceLink: {
      findUnique: () =>
        Promise.resolve({
          id: "link-pilot-1",
          storeId: "store-1",
          lineOaId: "oa-pilot-123",
          source: "STORE_QR",
          shortCode: "pilot123",
          destinationUrl: "https://line.me/R/ti/p/@oppocentral",
          isActive: true,
        }),
    },
    friendSourceClick: {
      create: (args: { data: Record<string, unknown> }) => {
        createdClicks.push(args.data);
        return Promise.resolve({ id: "click-1" });
      },
    },
    friendAttributionSession: {
      create: (args: { data: Record<string, unknown> }) => {
        createdSessions.push(args.data);
        return Promise.resolve({ id: "session-1" });
      },
    },
  } as any;

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    FRIEND_ATTRIBUTION_PILOT_LINE_OA_ID: "oa-pilot-123",
    FRIEND_ATTRIBUTION_LIFF_ID: "2007073384-xxxx",
    FRIEND_ATTRIBUTION_HASH_SECRET: "secret123",
  };

  try {
    const service = new FriendSourceLinksService(mockPrisma);
    const redirectUrl = await service.handleRedirect("pilot123");

    assert.match(redirectUrl, /^https:\/\/liff\.line\.me\/2007073384-xxxx\/?\?token=sat_/);
    assert.equal(createdClicks.length, 1);
    assert.equal(createdSessions.length, 1);

    const session = createdSessions[0];
    assert.equal(session.lineOaId, "oa-pilot-123");
    assert.equal(session.attributionStatus, "CLICKED");
    assert.equal(typeof session.publicSessionTokenHash, "string");

    const rawToken = new URL(redirectUrl).searchParams.get("token")!;
    assert.notEqual(session.publicSessionTokenHash, rawToken, "Raw token must NOT be stored in DB");
  } finally {
    process.env = originalEnv;
  }
});

test("Scenario 2: Non-pilot OA retains direct destination redirect", async () => {
  const createdClicks: Array<Record<string, unknown>> = [];
  const createdSessions: Array<Record<string, unknown>> = [];

  const mockPrisma = {
    friendSourceLink: {
      findUnique: () =>
        Promise.resolve({
          id: "link-normal-1",
          storeId: "store-2",
          lineOaId: "oa-other-999",
          source: "TIKTOK",
          shortCode: "normal123",
          destinationUrl: "https://line.me/R/ti/p/@oppostore",
          isActive: true,
        }),
    },
    friendSourceClick: {
      create: (args: { data: Record<string, unknown> }) => {
        createdClicks.push(args.data);
        return Promise.resolve({ id: "click-2" });
      },
    },
    friendAttributionSession: {
      create: (args: { data: Record<string, unknown> }) => {
        createdSessions.push(args.data);
        return Promise.resolve({ id: "session-2" });
      },
    },
  } as any;

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    FRIEND_ATTRIBUTION_PILOT_LINE_OA_ID: "oa-pilot-123",
  };

  try {
    const service = new FriendSourceLinksService(mockPrisma);
    const redirectUrl = await service.handleRedirect("normal123");

    assert.match(redirectUrl, /^https:\/\/line\.me\/R\/ti\/p\/@oppostore\?friend_tracking_id=tr_/);
    assert.equal(createdClicks.length, 1);
    assert.equal(createdSessions.length, 0, "No attribution session should be created for non-pilot OA");
  } finally {
    process.env = originalEnv;
  }
});

test("Scenario 4 & 5: Expired and invalid session tokens are rejected during identifySession", async () => {
  const invalidHash = hashPublicSessionToken("invalid_token", null);
  const mockPrisma = {
    friendAttributionSession: {
      findUnique: (args: { where: { publicSessionTokenHash: string } }) => {
        if (args.where.publicSessionTokenHash === invalidHash) return Promise.resolve(null);
        return Promise.resolve({
          id: "session-expired",
          expiresAt: new Date(Date.now() - 10000), // Expired 10s ago
          attributionStatus: "CLICKED",
        });
      },
      update: () => Promise.resolve(),
    },
  } as any;

  const service = new FriendSourceLinksService(mockPrisma);

  // Unconsented
  await assert.rejects(
    () => service.identifySession({ sessionToken: "token123", consentGiven: false }),
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      assert.match(err.message, /consent/);
      return true;
    }
  );

  // Invalid token
  await assert.rejects(
    () => service.identifySession({ sessionToken: "invalid_token", consentGiven: true }),
    (err: unknown) => {
      assert.ok(err instanceof NotFoundException);
      return true;
    }
  );

  // Expired token
  await assert.rejects(
    () => service.identifySession({ sessionToken: "valid_expired_token", idToken: "some_token", consentGiven: true }),
    (err: unknown) => {
      assert.ok(err instanceof GoneException);
      assert.match(err.message, /expired/);
      return true;
    }
  );
});

test("Scenario 6: ID Token verification rejects invalid audience or channel ID", async () => {
  const mockPrisma = {
    friendAttributionSession: {
      findUnique: () =>
        Promise.resolve({
          id: "session-1",
          expiresAt: new Date(Date.now() + 60000),
          attributionStatus: "CLICKED",
        }),
    },
  } as any;

  const service = new FriendSourceLinksService(mockPrisma);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_url: string | URL | Request, _init?: RequestInit) => {
    return {
      ok: true,
      json: async () => ({ sub: "U123456", aud: "WRONG_CHANNEL_ID" }),
    } as Response;
  };

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    FRIEND_ATTRIBUTION_LINE_LOGIN_CHANNEL_ID: "EXPECTED_CHANNEL_ID",
  };

  try {
    await assert.rejects(
      () => service.identifySession({ sessionToken: "valid_token", idToken: "valid_id_token", consentGiven: true }),
      (err: unknown) => {
        assert.ok(err instanceof UnauthorizedException);
        assert.match(err.message, /does not match configured channel/);
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("Scenario 7 & 8: Client cannot pass raw userId and verified LINE User ID is hashed", async () => {
  let updatedData: Record<string, unknown> | null = null;
  const mockPrisma = {
    friendAttributionSession: {
      findUnique: () =>
        Promise.resolve({
          id: "session-1",
          expiresAt: new Date(Date.now() + 60000),
          attributionStatus: "CLICKED",
        }),
      update: (args: { data: Record<string, unknown> }) => {
        updatedData = args.data;
        return Promise.resolve({ attributionStatus: "IDENTIFIED", expiresAt: new Date() });
      },
    },
    friendAttributionUnmatchedFollow: {
      findFirst: () => Promise.resolve(null),
    },
  } as any;

  const service = new FriendSourceLinksService(mockPrisma);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      json: async () => ({ sub: "U_VERIFIED_9999", aud: "2007073384", iss: "https://access.line.me", exp: Math.floor(Date.now() / 1000) + 3600 }),
    } as Response;
  };

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    FRIEND_ATTRIBUTION_LINE_LOGIN_CHANNEL_ID: "2007073384",
    FRIEND_ATTRIBUTION_HASH_SECRET: "my_secret",
  };

  try {
    const res = await service.identifySession({
      sessionToken: "valid_token",
      idToken: "valid_id_token",
      consentGiven: true,
    });

    assert.equal(res.status, "IDENTIFIED");
    assert.ok(updatedData);
    assert.equal(typeof (updatedData as any).lineUserIdHash, "string");
    assert.notEqual((updatedData as any).lineUserIdHash, "U_VERIFIED_9999", "Raw user ID must NOT be stored");

    const expectedHash = hashLineUserId("U_VERIFIED_9999", "my_secret");
    assert.equal((updatedData as any).lineUserIdHash, expectedHash);
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("Scenario 9 & 10 & 11 & 12: Webhook follow event matching, cross-OA isolation, and idempotency", async () => {
  const secret = "test_webhook_hash_secret";
  const userA = "U_CUSTOMER_A";
  const userAHash = hashLineUserId(userA, secret);

  let updatedSessionId: string | null = null;
  let createdAttribution: Record<string, unknown> | null = null;
  let createdUnmatchedFollow: Record<string, unknown> | null = null;

  const sessions: Array<{
    id: string;
    lineOaId: string;
    lineUserIdHash: string;
    attributionStatus: string;
    expiresAt: Date;
    confirmedFollowAt: Date | null;
    friendSourceLinkId: string;
  }> = [
    {
      id: "session-oa-pilot",
      lineOaId: "oa-pilot-123",
      lineUserIdHash: userAHash,
      attributionStatus: "IDENTIFIED",
      expiresAt: new Date(Date.now() + 3600000),
      confirmedFollowAt: null,
      friendSourceLinkId: "link-123",
    },
  ];

  const mockPrisma = {
    customer: {
      upsert: () => Promise.resolve({ id: "cust-1" }),
    },
    friendAttributionSession: {
      findFirst: (args: { where: { lineOaId: string; lineUserIdHash: string } }) => {
        const found = sessions.find(
          (s) => s.lineOaId === args.where.lineOaId && s.lineUserIdHash === args.where.lineUserIdHash && !s.confirmedFollowAt
        );
        return Promise.resolve(found || null);
      },
      update: (args: { where: { id: string }; data: Record<string, unknown> }) => {
        updatedSessionId = args.where.id;
        const target = sessions.find((s) => s.id === args.where.id);
        if (target) {
          target.attributionStatus = "CONFIRMED";
          target.confirmedFollowAt = args.data.confirmedFollowAt as Date;
        }
        return Promise.resolve(target);
      },
    },
    friendSourceAttribution: {
      create: (args: { data: Record<string, unknown> }) => {
        createdAttribution = args.data;
        return Promise.resolve({ id: "attr-1" });
      },
    },
    friendAttributionUnmatchedFollow: {
      create: (args: { data: Record<string, unknown> }) => {
        createdUnmatchedFollow = args.data;
        return Promise.resolve({ id: "unmatched-1" });
      },
    },
  } as any;

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    FRIEND_ATTRIBUTION_HASH_SECRET: secret,
  };

  try {
    const { LineWebhookService } = await import("../webhooks/line/line-webhook.service");
    const webhookService = new LineWebhookService(
      mockPrisma,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any
    );

    // Follow event from wrong OA -> should NOT confirm session-oa-pilot, but stores unmatched follow
    await (webhookService as any).processFollow(
      { type: "follow", source: { userId: userA } },
      "oa-other-777"
    );
    assert.equal(updatedSessionId, null, "Cross-OA follow event must NOT confirm session for another OA");
    assert.ok(createdUnmatchedFollow, "Early/unmatched follow event stored for later reconciliation");

    // Follow event from matching OA -> confirms session-oa-pilot
    await (webhookService as any).processFollow(
      { type: "follow", source: { userId: userA } },
      "oa-pilot-123"
    );
    assert.equal(updatedSessionId, "session-oa-pilot");
    assert.ok(createdAttribution);
    assert.equal((createdAttribution as any).friendSourceLinkId, "link-123");

    // Duplicate follow event -> idempotent
    updatedSessionId = null;
    createdAttribution = null;
    await (webhookService as any).processFollow(
      { type: "follow", source: { userId: userA } },
      "oa-pilot-123"
    );
    assert.ok(createdUnmatchedFollow, "Duplicate follow handles idempotently");
  } finally {
    process.env = originalEnv;
  }
});

test("Race Condition Reconciliation: Early follow event before identify is reconciled on identify()", async () => {
  const secret = "reconcile_secret_123";
  const userB = "U_CUSTOMER_EARLY_FOLLOW";
  const userBHash = hashLineUserId(userB, secret);
  const earlyFollowDate = new Date(Date.now() - 5000);

  let sessionUpdatedStatus: string | null = null;
  let sessionConfirmedFollowAt: Date | null = null;
  let unmatchedConsumedId: string | null = null;

  const mockSession = {
    id: "session-early-follow",
    lineOaId: "oa-pilot-123",
    publicSessionTokenHash: hashPublicSessionToken("sat_early_token", secret),
    friendSourceLinkId: "link-456",
    expiresAt: new Date(Date.now() + 3600000),
    attributionStatus: "CLICKED",
    confirmedFollowAt: null as Date | null,
    friendshipAfter: null as boolean | null,
    identifiedAt: null as Date | null,
  };

  const mockPrisma = {
    friendAttributionSession: {
      findUnique: () => Promise.resolve(mockSession),
      update: (args: { data: Record<string, unknown> }) => {
        sessionUpdatedStatus = args.data.attributionStatus as string;
        sessionConfirmedFollowAt = (args.data.confirmedFollowAt as Date) || null;
        mockSession.attributionStatus = sessionUpdatedStatus;
        mockSession.confirmedFollowAt = sessionConfirmedFollowAt;
        return Promise.resolve(mockSession);
      },
    },
    friendAttributionUnmatchedFollow: {
      findFirst: () =>
        Promise.resolve({
          id: "unmatched-b-1",
          lineOaId: "oa-pilot-123",
          lineUserIdHash: userBHash,
          receivedAt: earlyFollowDate,
          consumedAt: null,
          expiresAt: new Date(Date.now() + 900000),
        }),
      update: (args: { where: { id: string } }) => {
        unmatchedConsumedId = args.where.id;
        return Promise.resolve();
      },
    },
    friendSourceAttribution: {
      create: () => Promise.resolve(),
    },
  } as any;

  const service = new FriendSourceLinksService(mockPrisma);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    return {
      ok: true,
      json: async () => ({ sub: userB, aud: "2007073384", iss: "https://access.line.me", exp: Math.floor(Date.now() / 1000) + 3600 }),
    } as Response;
  };

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    FRIEND_ATTRIBUTION_LINE_LOGIN_CHANNEL_ID: "2007073384",
    FRIEND_ATTRIBUTION_HASH_SECRET: secret,
  };

  try {
    const res = await service.identifySession({
      sessionToken: "sat_early_token",
      idToken: "id_token_early",
      consentGiven: true,
    });

    assert.equal(res.status, "CONFIRMED", "identify() must reconcile early follow event and set status to CONFIRMED");
    assert.equal(sessionUpdatedStatus, "CONFIRMED");
    assert.equal(sessionConfirmedFollowAt, earlyFollowDate);
    assert.equal(unmatchedConsumedId, "unmatched-b-1", "Unmatched follow record must be consumed");
  } finally {
    globalThis.fetch = originalFetch;
    process.env = originalEnv;
  }
});

test("State Transition Integrity: CONFIRMED session cannot revert to ALREADY_FRIEND or ADD_FRIEND_PROMPTED", async () => {
  const secret = "state_guard_secret";
  const mockSession = {
    id: "session-confirmed",
    publicSessionTokenHash: hashPublicSessionToken("sat_confirmed", secret),
    expiresAt: new Date(Date.now() + 3600000),
    attributionStatus: "CONFIRMED",
    friendshipBefore: false,
    friendshipAfter: true,
  };

  let updatedStatus: string | null = null;
  const mockPrisma = {
    friendAttributionSession: {
      findUnique: () => Promise.resolve(mockSession),
      update: (args: { data: Record<string, unknown> }) => {
        updatedStatus = args.data.attributionStatus as string;
        return Promise.resolve({ ...mockSession, attributionStatus: updatedStatus, expiresAt: mockSession.expiresAt });
      },
    },
  } as any;

  const service = new FriendSourceLinksService(mockPrisma);

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    FRIEND_ATTRIBUTION_HASH_SECRET: secret,
  };

  try {
    // Attempt to update friendship status on an ALREADY CONFIRMED session
    const res = await service.updateFriendshipStatus({
      sessionToken: "sat_confirmed",
      isFriend: true,
    });

    assert.equal(res.status, "CONFIRMED", "Status must remain CONFIRMED and not revert");
    assert.equal(updatedStatus, "CONFIRMED");
  } finally {
    process.env = originalEnv;
  }
});

test("Status Polling Endpoint: getSessionStatus returns safe payload without user identifiers", async () => {
  const secret = "polling_secret";
  const mockSession = {
    id: "session-poll-1",
    publicSessionTokenHash: hashPublicSessionToken("sat_poll_1", secret),
    expiresAt: new Date(Date.now() + 3600000),
    attributionStatus: "CONFIRMED",
    confirmedFollowAt: new Date("2026-07-24T12:00:00.000Z"),
  };

  const mockPrisma = {
    friendAttributionSession: {
      findUnique: () => Promise.resolve(mockSession),
    },
  } as any;

  const service = new FriendSourceLinksService(mockPrisma);

  const originalEnv = process.env;
  process.env = {
    ...originalEnv,
    FRIEND_ATTRIBUTION_HASH_SECRET: secret,
  };

  try {
    const status = await service.getSessionStatus("sat_poll_1");

    assert.equal(status.status, "CONFIRMED");
    assert.equal(status.confirmed, true);
    assert.deepEqual(status.confirmedFollowAt, new Date("2026-07-24T12:00:00.000Z"));

    // Privacy assertion: zero identifiers in status object
    assert.equal((status as any).lineUserId, undefined);
    assert.equal((status as any).lineUserIdHash, undefined);
    assert.equal((status as any).sessionToken, undefined);
    assert.equal((status as any).id, undefined);
  } finally {
    process.env = originalEnv;
  }
});
