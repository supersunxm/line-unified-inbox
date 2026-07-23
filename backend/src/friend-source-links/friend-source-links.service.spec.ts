import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException, GoneException, NotFoundException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FriendSourceLinksService, deriveDefaultDestinationUrl, generateShortCode } from "./friend-source-links.service";
import { FriendSourceLinksController } from "./friend-source-links.controller";
import { REQUIRED_ROLES } from "../auth/auth.decorators";
import { PrismaService } from "../prisma.service";

void test("deriveDefaultDestinationUrl formats basicId with @ correctly", () => {
  assert.equal(deriveDefaultDestinationUrl("@oppo_store"), "https://line.me/R/ti/p/%40oppo_store");
  assert.equal(deriveDefaultDestinationUrl("oppo_store"), "https://line.me/R/ti/p/%40oppo_store");
});

void test("generateShortCode creates URL-safe string of specified length", () => {
  const code = generateShortCode(8);
  assert.equal(code.length, 8);
  assert.match(code, /^[a-zA-Z0-9]+$/);
});

void test("generation for one LINE OA creates exactly four sources", async () => {
  const store = { id: "store-1", name: "Store 1", code: "S1", isActive: true };
  const oa = { id: "oa-1", storeId: "store-1", name: "OA 1", basicId: "@oa1", connectionStatus: "CONNECTED", isActive: true, store };

  const links: any[] = [];
  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => [oa],
    },
    friendSourceLink: {
      findUnique: async ({ where }: any) => {
        if (where?.lineOaId_source) {
          return links.find((l) => l.lineOaId === where.lineOaId_source.lineOaId && l.source === where.lineOaId_source.source) || null;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const newLink = { ...data, id: `link-${links.length + 1}`, store, lineOa: oa, _count: { clicks: 0 }, createdAt: new Date(), updatedAt: new Date() };
        links.push(newLink);
        return newLink;
      },
    },
  };

  const service = new FriendSourceLinksService(mockPrisma as PrismaService);
  const result = await service.generateLinks({ lineOaIds: ["oa-1"] });

  assert.equal(result.createdCount, 4);
  assert.equal(result.existingCount, 0);
  assert.equal(result.items.length, 4);
  const sources = result.items.map((i) => i.source);
  assert.deepEqual(sources.sort(), ["FACEBOOK", "INSTAGRAM", "STORE_QR", "TIKTOK"]);
});

void test("generation for five LINE OAs creates exactly twenty links", async () => {
  const stores = Array.from({ length: 5 }, (_, i) => ({ id: `store-${i + 1}`, name: `Store ${i + 1}`, code: `S${i + 1}`, isActive: true }));
  const oas = Array.from({ length: 5 }, (_, i) => ({ id: `oa-${i + 1}`, storeId: `store-${i + 1}`, name: `OA ${i + 1}`, basicId: `@oa${i + 1}`, connectionStatus: "READY", isActive: true, store: stores[i] }));

  const links: any[] = [];
  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => oas,
    },
    friendSourceLink: {
      findUnique: async ({ where }: any) => {
        if (where?.lineOaId_source) {
          return links.find((l) => l.lineOaId === where.lineOaId_source.lineOaId && l.source === where.lineOaId_source.source) || null;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const oa = oas.find((o) => o.id === data.lineOaId)!;
        const newLink = { ...data, id: `link-${links.length + 1}`, store: oa.store, lineOa: oa, _count: { clicks: 0 }, createdAt: new Date(), updatedAt: new Date() };
        links.push(newLink);
        return newLink;
      },
    },
  };

  const service = new FriendSourceLinksService(mockPrisma as PrismaService);
  const result = await service.generateLinks({ lineOaIds: oas.map((o) => o.id) });

  assert.equal(result.createdCount, 20);
  assert.equal(result.existingCount, 0);
  assert.equal(result.items.length, 20);
});

void test("repeated generation creates zero duplicates (idempotent)", async () => {
  const store = { id: "store-1", name: "Store 1", code: "S1", isActive: true };
  const oa = { id: "oa-1", storeId: "store-1", name: "OA 1", basicId: "@oa1", connectionStatus: "CONNECTED", isActive: true, store };

  const links: any[] = [];
  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => [oa],
    },
    friendSourceLink: {
      findUnique: async ({ where }: any) => {
        if (where?.lineOaId_source) {
          return links.find((l) => l.lineOaId === where.lineOaId_source.lineOaId && l.source === where.lineOaId_source.source) || null;
        }
        return null;
      },
      create: async ({ data }: any) => {
        const newLink = { ...data, id: `link-${links.length + 1}`, store, lineOa: oa, _count: { clicks: 0 }, createdAt: new Date(), updatedAt: new Date() };
        links.push(newLink);
        return newLink;
      },
    },
  };

  const service = new FriendSourceLinksService(mockPrisma as PrismaService);
  const first = await service.generateLinks({ lineOaIds: ["oa-1"] });
  assert.equal(first.createdCount, 4);

  const second = await service.generateLinks({ lineOaIds: ["oa-1"] });
  assert.equal(second.createdCount, 0);
  assert.equal(second.existingCount, 4);
  assert.equal(second.items.length, 4);
});

void test("more than five LINE OAs is rejected", async () => {
  const service = new FriendSourceLinksService({} as any);
  await assert.rejects(
    () => service.generateLinks({ lineOaIds: ["oa-1", "oa-2", "oa-3", "oa-4", "oa-5", "oa-6"] }),
    (err: any) => {
      assert.ok(err instanceof BadRequestException);
      assert.ok(err.message.includes("maximum 5"));
      return true;
    }
  );
});

void test("duplicate IDs are normalized deterministically", async () => {
  const store = { id: "store-1", name: "Store 1", code: "S1", isActive: true };
  const oa = { id: "oa-1", storeId: "store-1", name: "OA 1", basicId: "@oa1", connectionStatus: "CONNECTED", isActive: true, store };

  const links: any[] = [];
  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async ({ where }: any) => {
        if (where?.id?.in?.includes("oa-1")) return [oa];
        return [];
      },
    },
    friendSourceLink: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        const newLink = { ...data, id: `link-${links.length + 1}`, store, lineOa: oa, _count: { clicks: 0 }, createdAt: new Date(), updatedAt: new Date() };
        links.push(newLink);
        return newLink;
      },
    },
  };

  const service = new FriendSourceLinksService(mockPrisma as PrismaService);
  const result = await service.generateLinks({ lineOaIds: ["oa-1", "oa-1", "oa-1"] });

  assert.equal(result.createdCount, 4);
  assert.equal(result.items.length, 4);
});

void test("inactive/not-ready LINE OA is rejected", async () => {
  const store = { id: "store-1", name: "Store 1", code: "S1", isActive: true };
  const oa = { id: "oa-1", storeId: "store-1", name: "OA 1", basicId: "@oa1", connectionStatus: "NOT_CONFIGURED", isActive: true, store };

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => [oa],
    },
  };

  const service = new FriendSourceLinksService(mockPrisma as PrismaService);
  await assert.rejects(
    () => service.generateLinks({ lineOaIds: ["oa-1"] }),
    (err: any) => {
      assert.ok(err instanceof BadRequestException);
      assert.ok(err.message.includes("not CONNECTED or READY"));
      return true;
    }
  );
});

void test("missing basicId is rejected", async () => {
  const store = { id: "store-1", name: "Store 1", code: "S1", isActive: true };
  const oa = { id: "oa-1", storeId: "store-1", name: "OA 1", basicId: null, connectionStatus: "CONNECTED", isActive: true, store };

  const mockPrisma: any = {
    lineOfficialAccount: {
      findMany: async () => [oa],
    },
  };

  const service = new FriendSourceLinksService(mockPrisma as PrismaService);
  await assert.rejects(
    () => service.generateLinks({ lineOaIds: ["oa-1"] }),
    (err: any) => {
      assert.ok(err instanceof BadRequestException);
      assert.ok(err.message.includes("missing basicId"));
      return true;
    }
  );
});

void test("short-code collision retry", async () => {
  const store = { id: "store-1", name: "Store 1", code: "S1", isActive: true };
  const oa = { id: "oa-1", storeId: "store-1", name: "OA 1", basicId: "@oa1", connectionStatus: "CONNECTED", isActive: true, store };

  let p2002Retries = 0;
  const mockPrisma: any = {
    lineOfficialAccount: { findMany: async () => [oa] },
    friendSourceLink: {
      findUnique: async () => null,
      create: async ({ data }: any) => {
        if (p2002Retries === 0) {
          p2002Retries++;
          const err: any = new Error("Unique constraint failed");
          err.code = "P2002";
          err.meta = { target: ["shortCode"] };
          throw err;
        }
        return { ...data, id: "link-retry", store, lineOa: oa, _count: { clicks: 0 }, createdAt: new Date(), updatedAt: new Date() };
      },
    },
  };

  const service = new FriendSourceLinksService(mockPrisma as PrismaService);
  const result = await service.generateLinks({ lineOaIds: ["oa-1"] });

  assert.equal(p2002Retries, 1, "Must retry on P2002 shortCode collision");
  assert.equal(result.createdCount, 4);
});

void test("redirect records a click and appends friend_tracking_id while preserving existing query parameters", async () => {
  let createdClick: any = null;
  const link = {
    id: "link-1",
    shortCode: "testcode",
    destinationUrl: "https://line.me/R/ti/p/%40oppo_test?utm_source=qr&promo=2026",
    isActive: true,
  };

  const mockPrisma: any = {
    friendSourceLink: {
      findUnique: async ({ where }: any) => {
        if (where?.shortCode === "testcode") return link;
        return null;
      },
    },
    friendSourceClick: {
      create: async ({ data }: any) => {
        createdClick = data;
        return { id: "click-1", ...data, clickedAt: new Date() };
      },
    },
  };

  const savedKey = process.env.FRIEND_SOURCE_IP_HASH_KEY;
  process.env.FRIEND_SOURCE_IP_HASH_KEY = "test-secret-key-123";

  try {
    const service = new FriendSourceLinksService(mockPrisma as PrismaService);
    const redirectUrl = await service.handleRedirect("testcode", "https://tiktok.com", "Mozilla/5.0", "1.2.3.4");

  assert.ok(createdClick, "Click record must be created");
  assert.equal(createdClick.friendSourceLinkId, "link-1");
  assert.ok(createdClick.trackingSessionId.startsWith("tr_"));
  assert.equal(createdClick.referrer, "https://tiktok.com");
  assert.equal(createdClick.userAgent, "Mozilla/5.0");
  assert.notEqual(createdClick.ipHash, "1.2.3.4", "Raw IP address must NEVER be stored");
  assert.ok(createdClick.ipHash, "HMAC-SHA256 ipHash must be populated");

  const parsedTarget = new URL(redirectUrl);
  assert.equal(parsedTarget.origin, "https://line.me");
  assert.equal(parsedTarget.pathname, "/R/ti/p/%40oppo_test");
  assert.equal(parsedTarget.searchParams.get("utm_source"), "qr");
  assert.equal(parsedTarget.searchParams.get("promo"), "2026");
  assert.equal(parsedTarget.searchParams.get("friend_tracking_id"), createdClick.trackingSessionId);
  } finally {
    if (savedKey !== undefined) process.env.FRIEND_SOURCE_IP_HASH_KEY = savedKey;
    else delete process.env.FRIEND_SOURCE_IP_HASH_KEY;
  }
});

void test("unknown link returns 404", async () => {
  const mockPrisma: any = {
    friendSourceLink: { findUnique: async () => null },
  };

  const service = new FriendSourceLinksService(mockPrisma as PrismaService);
  await assert.rejects(
    () => service.handleRedirect("nonexist"),
    (err: any) => err instanceof NotFoundException
  );
});

void test("inactive link returns 410", async () => {
  const link = { id: "link-1", shortCode: "inactive", destinationUrl: "https://line.me/R/ti/p/@test", isActive: false };
  const mockPrisma: any = {
    friendSourceLink: { findUnique: async () => link },
  };

  const service = new FriendSourceLinksService(mockPrisma as PrismaService);
  await assert.rejects(
    () => service.handleRedirect("inactive"),
    (err: any) => err instanceof GoneException
  );
});

void test("raw IP is never stored and missing FRIEND_SOURCE_IP_HASH_KEY stores null ipHash", async () => {
  let createdClick: any = null;
  const link = { id: "link-1", shortCode: "ipcheck", destinationUrl: "https://line.me/R/ti/p/@test", isActive: true };
  const mockPrisma: any = {
    friendSourceLink: { findUnique: async () => link },
    friendSourceClick: { create: async ({ data }: any) => { createdClick = data; return { id: "c1", ...data }; } },
  };

  const savedKey = process.env.FRIEND_SOURCE_IP_HASH_KEY;
  delete process.env.FRIEND_SOURCE_IP_HASH_KEY;

  try {
    const service = new FriendSourceLinksService(mockPrisma as PrismaService);
    await service.handleRedirect("ipcheck", undefined, undefined, "192.168.1.100");

    assert.notEqual(createdClick.ipHash, "192.168.1.100", "Raw IP must never be stored");
    assert.equal(createdClick.ipHash, null, "ipHash must be null when key is missing in dev/test");
  } finally {
    if (savedKey !== undefined) process.env.FRIEND_SOURCE_IP_HASH_KEY = savedKey;
  }
});

void test("when FRIEND_SOURCE_IP_HASH_KEY is present, ipHash is stored as HMAC-SHA256 hex string", async () => {
  let createdClick: any = null;
  const link = { id: "link-1", shortCode: "ipcheck2", destinationUrl: "https://line.me/R/ti/p/@test", isActive: true };
  const mockPrisma: any = {
    friendSourceLink: { findUnique: async () => link },
    friendSourceClick: { create: async ({ data }: any) => { createdClick = data; return { id: "c2", ...data }; } },
  };

  const savedKey = process.env.FRIEND_SOURCE_IP_HASH_KEY;
  process.env.FRIEND_SOURCE_IP_HASH_KEY = "test-secret-key-123";

  try {
    const service = new FriendSourceLinksService(mockPrisma as PrismaService);
    await service.handleRedirect("ipcheck2", undefined, undefined, "192.168.1.100");

    assert.notEqual(createdClick.ipHash, "192.168.1.100");
    assert.match(createdClick.ipHash, /^[a-f0-9]{64}$/);
  } finally {
    if (savedKey !== undefined) process.env.FRIEND_SOURCE_IP_HASH_KEY = savedKey;
    else delete process.env.FRIEND_SOURCE_IP_HASH_KEY;
  }
});

void test("management endpoints reject non-admin users via @Roles(ADMIN) metadata", () => {
  const reflector = new Reflector();

  const generateRoles = reflector.get(REQUIRED_ROLES, FriendSourceLinksController.prototype.generate);
  assert.deepEqual(generateRoles, ["ADMIN"]);

  const listRoles = reflector.get(REQUIRED_ROLES, FriendSourceLinksController.prototype.list);
  assert.deepEqual(listRoles, ["ADMIN"]);

  const summaryRoles = reflector.get(REQUIRED_ROLES, FriendSourceLinksController.prototype.getSummary);
  assert.deepEqual(summaryRoles, ["ADMIN"]);

  const updateRoles = reflector.get(REQUIRED_ROLES, FriendSourceLinksController.prototype.update);
  assert.deepEqual(updateRoles, ["ADMIN"]);
});
