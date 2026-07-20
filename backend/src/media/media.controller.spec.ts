import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { NotFoundException } from "@nestjs/common";
import { REQUIRED_ROLES } from "../auth/auth.decorators";
import { PrismaService } from "../prisma.service";
import { MediaController } from "./media.controller";
import { MediaStorageService } from "./media-storage";

void test("authenticated ADMIN media retrieval streams private image bytes", async () => {
  const prisma = { messageMedia: { findUnique: () => Promise.resolve({ processingStatus: "READY", objectKey: "line-media/oa/2026/07/message.png", mimeType: "image/png", message: { conversation: { lineOfficialAccountId: "oa-1" } } }) } } as unknown as PrismaService;
  const storage = { get: () => Promise.resolve({ body: Buffer.from("image") }) } as unknown as MediaStorageService;
  const headers = new Map<string, string>();
  let sent: Buffer | undefined;
  const response = { setHeader: (key: string, value: string) => headers.set(key, value), send: (body: Buffer) => { sent = body; } };
  await new MediaController(prisma, storage).get("message-1", response as never);
  assert.equal(sent?.toString(), "image");
  assert.equal(headers.get("Content-Type"), "image/png");
  assert.equal(headers.get("Cache-Control"), "private, max-age=3600");
  const handler = Object.getOwnPropertyDescriptor(MediaController.prototype, "get")?.value as object;
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, handler) as string[], ["ADMIN"]);
});

void test("unavailable media is not disclosed", async () => {
  const prisma = { messageMedia: { findUnique: () => Promise.resolve({ processingStatus: "FAILED" }) } } as unknown as PrismaService;
  const controller = new MediaController(prisma, {} as MediaStorageService);
  await assert.rejects(() => controller.get("message-1", {} as never), NotFoundException);
});
