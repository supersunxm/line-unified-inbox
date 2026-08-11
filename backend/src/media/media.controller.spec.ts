import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { MediaController } from "./media.controller";
import { MediaStorageService } from "./media-storage";
import { StoreAccessService } from "../auth/store-access.service";

void test("authorized media retrieval streams private image bytes", async () => {
  const prisma = { messageMedia: { findUnique: () => Promise.resolve({ processingStatus: "READY", objectKey: "line-media/oa/2026/07/message.png", mimeType: "image/png", message: { conversation: { storeId: "store-1" } } }) } } as unknown as PrismaService;
  const storage = { get: () => Promise.resolve({ body: Buffer.from("image") }) } as unknown as MediaStorageService;
  let authorizedStoreId: string | undefined;
  const storeAccess = { assertStoreAccess: async (_user: unknown, storeId: string) => { authorizedStoreId = storeId; } } as unknown as StoreAccessService;
  const headers = new Map<string, string>();
  let sent: Buffer | undefined;
  const response = { setHeader: (key: string, value: string) => headers.set(key, value), send: (body: Buffer) => { sent = body; } };
  await new MediaController(prisma, storage, storeAccess).get("message-1", { user: { id: "user-1" } } as never, response as never);
  assert.equal(sent?.toString(), "image");
  assert.equal(authorizedStoreId, "store-1");
  assert.equal(headers.get("Content-Type"), "image/png");
  assert.equal(headers.get("Cache-Control"), "private, max-age=3600");
});

void test("unavailable media is not disclosed", async () => {
  const prisma = { messageMedia: { findUnique: () => Promise.resolve({ processingStatus: "FAILED" }) } } as unknown as PrismaService;
  const controller = new MediaController(prisma, {} as MediaStorageService, {} as StoreAccessService);
  await assert.rejects(() => controller.get("message-1", { user: { id: "user-1" } } as never, {} as never), NotFoundException);
});
