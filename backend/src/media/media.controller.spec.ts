import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MediaController } from "./media.controller";
import { MediaStorageService } from "./media-storage";
import { StoreAccessService } from "../auth/store-access.service";
import {
  createMediaPublicUrl,
  isAllowedPublicMediaObjectKey,
  verifyMediaPublicUrl,
} from "./media-public-url";

void test("authorized media retrieval streams private image bytes", async () => {
  const prisma = {
    messageMedia: {
      findUnique: () =>
        Promise.resolve({
          processingStatus: "READY",
          objectKey: "line-media/oa/2026/07/message.png",
          mimeType: "image/png",
          message: { conversation: { storeId: "store-1" } },
        }),
    },
  } as unknown as PrismaService;
  const storage = {
    get: () => Promise.resolve({ body: Buffer.from("image") }),
  } as unknown as MediaStorageService;
  let authorizedStoreId: string | undefined;
  const storeAccess = {
    assertStoreAccess: async (_user: unknown, storeId: string) => {
      authorizedStoreId = storeId;
    },
  } as unknown as StoreAccessService;
  const headers = new Map<string, string>();
  let sent: Buffer | undefined;
  const response = {
    setHeader: (key: string, value: string) => headers.set(key, value),
    send: (body: Buffer) => {
      sent = body;
    },
  };
  await new MediaController(prisma, storage, storeAccess).get(
    "message-1",
    { user: { id: "user-1" } } as never,
    response as never,
  );
  assert.equal(sent?.toString(), "image");
  assert.equal(authorizedStoreId, "store-1");
  assert.equal(headers.get("Content-Type"), "image/png");
  assert.equal(headers.get("Cache-Control"), "private, max-age=3600");
});

void test("unavailable media is not disclosed", async () => {
  const prisma = {
    messageMedia: { findUnique: () => Promise.resolve({ processingStatus: "FAILED" }) },
  } as unknown as PrismaService;
  const controller = new MediaController(prisma, {} as MediaStorageService, {} as StoreAccessService);
  await assert.rejects(
    () => controller.get("message-1", { user: { id: "user-1" } } as never, {} as never),
    NotFoundException,
  );
});

void test("isAllowedPublicMediaObjectKey enforces allowed namespaces and blocks path traversal", () => {
  // Allowed namespaces
  assert.equal(isAllowedPublicMediaObjectKey("line-media/outbound/test.jpg"), true);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/outbound/rich-menu/img-123.png"), true);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/auto-response/uuid-original.jpg"), true);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/auto-response/uuid-preview.png"), true);

  // Rejected unknown namespaces
  assert.equal(isAllowedPublicMediaObjectKey("private/file.jpg"), false);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/random/file.jpg"), false);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/oa/2026/07/secret.jpg"), false);

  // Rejected traversal attempts
  assert.equal(isAllowedPublicMediaObjectKey("line-media/../secret.jpg"), false);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/auto-response/../../secret.jpg"), false);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/outbound/..\\secret.jpg"), false);
  assert.equal(isAllowedPublicMediaObjectKey("/line-media/outbound/test.jpg"), false);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/outbound\\test.jpg"), false);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/auto-response%2f..%2fsecret.jpg"), false);
  assert.equal(isAllowedPublicMediaObjectKey("line-media/auto-response%2e%2esecret.jpg"), false);
  assert.equal(isAllowedPublicMediaObjectKey(""), false);
});

void test("publicMedia endpoint serves valid signed auto-response and outbound images without cookies", async () => {
  const fakeImageBytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
  const storage = {
    get: (key: string) => Promise.resolve({ body: fakeImageBytes, contentType: key.endsWith(".png") ? "image/png" : "image/jpeg" }),
  } as unknown as MediaStorageService;
  const controller = new MediaController({} as PrismaService, storage, {} as StoreAccessService);

  // 1. Valid signed Auto-response image
  const autoResponseKey = "line-media/auto-response/promo-uuid-preview.jpg";
  const autoResponseUrl = createMediaPublicUrl(autoResponseKey);
  const parsedAutoUrl = new URL(autoResponseUrl);

  const headers = new Map<string, string>();
  let sentBody: Buffer | undefined;
  const mockRes = {
    setHeader: (k: string, v: string) => headers.set(k, v),
    send: (b: Buffer) => {
      sentBody = b;
    },
  };

  await controller.publicMedia(
    {
      query: {
        key: parsedAutoUrl.searchParams.get("key"),
        expires: parsedAutoUrl.searchParams.get("expires"),
        signature: parsedAutoUrl.searchParams.get("signature"),
      },
    } as never,
    mockRes as never,
  );

  assert.equal(sentBody?.length, fakeImageBytes.length);
  assert.equal(headers.get("Content-Type"), "image/jpeg");
  assert.equal(headers.get("Content-Disposition"), "inline");

  // 2. Valid signed outbound image
  const outboundKey = "line-media/outbound/rich-menu/banner.png";
  const outboundUrl = createMediaPublicUrl(outboundKey);
  const parsedOutUrl = new URL(outboundUrl);

  const outboundHeaders = new Map<string, string>();
  let outboundSentBody: Buffer | undefined;
  const mockOutRes = {
    setHeader: (k: string, v: string) => outboundHeaders.set(k, v),
    send: (b: Buffer) => {
      outboundSentBody = b;
    },
  };

  await controller.publicMedia(
    {
      query: {
        key: parsedOutUrl.searchParams.get("key"),
        expires: parsedOutUrl.searchParams.get("expires"),
        signature: parsedOutUrl.searchParams.get("signature"),
      },
    } as never,
    mockOutRes as never,
  );

  assert.equal(outboundSentBody?.length, fakeImageBytes.length);
  assert.equal(outboundHeaders.get("Content-Type"), "image/png");
  assert.equal(outboundHeaders.get("Content-Disposition"), "inline");
});

void test("publicMedia endpoint strictly rejects invalid, expired, unknown namespace, and traversal requests", async () => {
  const storage = {
    get: () => Promise.resolve({ body: Buffer.from("image") }),
  } as unknown as MediaStorageService;
  const controller = new MediaController({} as PrismaService, storage, {} as StoreAccessService);

  // 1. Invalid signature
  const validUrl = createMediaPublicUrl("line-media/auto-response/preview.jpg");
  const parsed = new URL(validUrl);

  await assert.rejects(
    () =>
      controller.publicMedia(
        {
          query: {
            key: parsed.searchParams.get("key"),
            expires: parsed.searchParams.get("expires"),
            signature: "invalid-signature-hex-123456",
          },
        } as never,
        {} as never,
      ),
    NotFoundException,
  );

  // 2. Expired URL
  const expiredUrl = createMediaPublicUrl("line-media/auto-response/preview.jpg", -100);
  const parsedExpired = new URL(expiredUrl);

  await assert.rejects(
    () =>
      controller.publicMedia(
        {
          query: {
            key: parsedExpired.searchParams.get("key"),
            expires: parsedExpired.searchParams.get("expires"),
            signature: parsedExpired.searchParams.get("signature"),
          },
        } as never,
        {} as never,
      ),
    NotFoundException,
  );

  // 3. Unknown namespace
  const unknownKey = "private/secret-image.jpg";
  const unknownUrl = createMediaPublicUrl(unknownKey);
  const parsedUnknown = new URL(unknownUrl);

  await assert.rejects(
    () =>
      controller.publicMedia(
        {
          query: {
            key: parsedUnknown.searchParams.get("key"),
            expires: parsedUnknown.searchParams.get("expires"),
            signature: parsedUnknown.searchParams.get("signature"),
          },
        } as never,
        {} as never,
      ),
    NotFoundException,
  );

  // 4. Traversal attempt
  const traversalKey = "line-media/auto-response/../../etc/passwd";
  const traversalUrl = createMediaPublicUrl(traversalKey);
  const parsedTraversal = new URL(traversalUrl);

  await assert.rejects(
    () =>
      controller.publicMedia(
        {
          query: {
            key: parsedTraversal.searchParams.get("key"),
            expires: parsedTraversal.searchParams.get("expires"),
            signature: parsedTraversal.searchParams.get("signature"),
          },
        } as never,
        {} as never,
      ),
    NotFoundException,
  );
});
