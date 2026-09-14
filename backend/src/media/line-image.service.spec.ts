import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import { MessageType } from "@prisma/client";
import { LineImageService } from "./line-image.service";
import { MediaStorageService } from "./media-storage";

type MediaUpdate = { processingStatus: string; mimeType?: string; objectKey?: string | null; fileSize?: number; provider?: string; fileId?: string; errorCode?: string };

async function runPdf(response: Response, filename = "customer-statement.pdf", maxBytes = "1024", declaredFileSize?: number) {
  const previousFetch = global.fetch;
  const previousMax = process.env.MEDIA_MAX_PDF_FILE_SIZE_BYTES;
  const previousEnabled = process.env.MEDIA_STORAGE_ENABLED;
  process.env.MEDIA_STORAGE_ENABLED = "true";
  process.env.MEDIA_MAX_PDF_FILE_SIZE_BYTES = maxBytes;
  let authorization = "";
  let update: MediaUpdate | undefined;
  let stored: { key: string; body: Buffer; mimeType: string } | undefined;
  global.fetch = (_url: string | URL | Request, init?: RequestInit) => {
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Promise.resolve(response);
  };
  const prisma = {
    lineOfficialAccount: { findUnique: () => Promise.resolve({ encryptedChannelAccessToken: "encrypted-token" }) },
    messageMedia: { update: ({ data }: { data: MediaUpdate }) => { update = data; return Promise.resolve({}); } },
  } as unknown as PrismaService;
  const encryption = { decrypt: () => "oa-specific-token" } as unknown as CredentialEncryptionService;
  const storage = { put: (key: string, body: Buffer, mimeType: string) => { stored = { key, body, mimeType }; return Promise.resolve({ provider: "s3", fileId: key, mimeType, size: body.length }); } } as unknown as MediaStorageService;
  try {
    await new LineImageService(prisma, encryption, storage).processPdf("media-pdf-1", "oa-1", "line-pdf-1", new Date("2026-07-20T00:00:00Z"), filename, declaredFileSize);
    return { authorization, update, stored };
  } finally {
    global.fetch = previousFetch;
    if (previousMax === undefined) delete process.env.MEDIA_MAX_PDF_FILE_SIZE_BYTES; else process.env.MEDIA_MAX_PDF_FILE_SIZE_BYTES = previousMax;
    if (previousEnabled === undefined) delete process.env.MEDIA_STORAGE_ENABLED; else process.env.MEDIA_STORAGE_ENABLED = previousEnabled;
  }
}

async function runImage(response: Response, maxBytes = "1024", mediaType = MessageType.IMAGE) {
  const previousFetch = global.fetch;
  const previousMax = process.env.MEDIA_MAX_FILE_SIZE_BYTES;
  const previousVideoMax = process.env.MEDIA_MAX_VIDEO_FILE_SIZE_BYTES;
  const previousEnabled = process.env.MEDIA_STORAGE_ENABLED;
  process.env.MEDIA_STORAGE_ENABLED = "true";
  if (mediaType === MessageType.VIDEO) process.env.MEDIA_MAX_VIDEO_FILE_SIZE_BYTES = maxBytes;
  else process.env.MEDIA_MAX_FILE_SIZE_BYTES = maxBytes;
  let authorization = "";
  let requestedUrl = "";
  let update: MediaUpdate | undefined;
  let stored: { key: string; body: Buffer; mimeType: string } | undefined;
  global.fetch = (_url: string | URL | Request, init?: RequestInit) => {
    requestedUrl = typeof _url === "string" ? _url : _url instanceof URL ? _url.toString() : _url.url;
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Promise.resolve(response);
  };
  const prisma = {
    lineOfficialAccount: { findUnique: () => Promise.resolve({ encryptedChannelAccessToken: "encrypted-token" }) },
    messageMedia: { update: ({ data }: { data: MediaUpdate }) => { update = data; return Promise.resolve({}); } },
  } as unknown as PrismaService;
  const encryption = { decrypt: () => "oa-specific-token" } as unknown as CredentialEncryptionService;
  const storage = { put: (key: string, body: Buffer, mimeType: string) => { stored = { key, body, mimeType }; return Promise.resolve({ provider: "s3", fileId: key, mimeType, size: body.length }); } } as unknown as MediaStorageService;
  try {
    await new LineImageService(prisma, encryption, storage).process("media-1", "oa-1", "line-message-1", new Date("2026-07-20T00:00:00Z"), mediaType);
    return { authorization, requestedUrl, update, stored };
  } finally {
    global.fetch = previousFetch;
    if (previousMax === undefined) delete process.env.MEDIA_MAX_FILE_SIZE_BYTES; else process.env.MEDIA_MAX_FILE_SIZE_BYTES = previousMax;
    if (previousVideoMax === undefined) delete process.env.MEDIA_MAX_VIDEO_FILE_SIZE_BYTES; else process.env.MEDIA_MAX_VIDEO_FILE_SIZE_BYTES = previousVideoMax;
    if (previousEnabled === undefined) delete process.env.MEDIA_STORAGE_ENABLED; else process.env.MEDIA_STORAGE_ENABLED = previousEnabled;
  }
}

void test("image download uses the exact OA token and stores supported content", async () => {
  const result = await runImage(new Response(Buffer.from("image"), { status: 200, headers: { "content-type": "image/png", "content-length": "5" } }));
  assert.equal(result.authorization, "Bearer oa-specific-token");
  assert.equal(result.requestedUrl, "https://api-data.line.me/v2/bot/message/line-message-1/content");
  assert.equal(result.update?.processingStatus, "READY");
  assert.equal(result.update?.mimeType, "image/png");
  assert.equal(result.update?.fileSize, 5);
  assert.equal(result.update?.provider, "s3");
  assert.equal(result.update?.fileId, result.stored?.key);
  assert.equal(result.update?.objectKey, result.stored?.key);
  assert.match(result.stored?.key ?? "", /^line-media\/oa-1\/2026\/07\/line-message-1\.png$/);
  assert.equal(JSON.stringify(result).includes("oa-specific-token"), true);
});

void test("video download uses the canonical LINE content endpoint and stores video media", async () => {
  const result = await runImage(new Response(Buffer.from("video"), { status: 200, headers: { "content-type": "video/mp4", "content-length": "5" } }), "1024", MessageType.VIDEO);
  assert.equal(result.update?.processingStatus, "READY");
  assert.equal(result.update?.mimeType, "video/mp4");
  assert.equal(result.update?.fileSize, 5);
  assert.match(result.stored?.key ?? "", /\.mp4$/);
});

void test("disabled media storage skips without downloading or storing", async () => {
  const previousEnabled = process.env.MEDIA_STORAGE_ENABLED; delete process.env.MEDIA_STORAGE_ENABLED;
  const previousFetch = global.fetch; let fetched = false; let stored = false; let update: MediaUpdate | undefined;
  global.fetch = () => { fetched = true; return Promise.resolve(new Response()); };
  const prisma = { messageMedia: { update: ({ data }: { data: MediaUpdate }) => { update = data; return Promise.resolve({}); } } } as unknown as PrismaService;
  const storage = { put: () => { stored = true; return Promise.resolve(); } } as unknown as MediaStorageService;
  try { await new LineImageService(prisma, {} as CredentialEncryptionService, storage).process("media-1", "oa-1", "line-message-1", new Date()); }
  finally { global.fetch = previousFetch; if (previousEnabled === undefined) delete process.env.MEDIA_STORAGE_ENABLED; else process.env.MEDIA_STORAGE_ENABLED = previousEnabled; }
  assert.equal(update?.processingStatus, "SKIPPED"); assert.equal(update?.errorCode, "MEDIA_STORAGE_DISABLED"); assert.equal(fetched, false); assert.equal(stored, false);
});

void test("unsupported MIME type and oversized images become FAILED", async () => {
  const unsupported = await runImage(new Response("not image", { status: 200, headers: { "content-type": "text/html" } }));
  assert.equal(unsupported.update?.processingStatus, "FAILED");
  assert.equal(unsupported.update?.errorCode, "UNSUPPORTED_MIME_TYPE");
  const oversized = await runImage(new Response(Buffer.alloc(12), { status: 200, headers: { "content-type": "image/jpeg", "content-length": "12" } }), "10");
  assert.equal(oversized.update?.processingStatus, "FAILED");
  assert.equal(oversized.update?.errorCode, "MEDIA_TOO_LARGE");
  const streamedOversized = await runImage(new Response(Buffer.alloc(12), { status: 200, headers: { "content-type": "image/webp" } }), "10");
  assert.equal(streamedOversized.update?.errorCode, "MEDIA_TOO_LARGE");
});

void test("LINE 404 and 410 are recorded as FAILED without throwing", async () => {
  for (const status of [404, 410]) {
    const result = await runImage(new Response(null, { status }));
    assert.equal(result.update?.processingStatus, "FAILED");
    assert.equal(result.update?.errorCode, `LINE_HTTP_${status}`);
  }
});

void test("inbound PDF uses the OA token, validates the response, and stores PDF metadata", async () => {
  const result = await runPdf(new Response(Buffer.from("%PDF-1.7\nbody"), { status: 200, headers: { "content-type": "application/pdf", "content-length": "13" } }));
  assert.equal(result.authorization, "Bearer oa-specific-token");
  assert.equal(result.update?.processingStatus, "READY");
  assert.equal(result.update?.mimeType, "application/pdf");
  assert.equal(result.update?.fileSize, 13);
  assert.match(result.stored?.key ?? "", /^line-media\/oa-1\/2026\/07\/line-pdf-1\.pdf$/);
});

void test("inbound PDF rejects unsupported filename, MIME, signature, and size", async () => {
  const wrongName = await runPdf(new Response(Buffer.from("%PDF-1.7"), { status: 200, headers: { "content-type": "application/pdf" } }), "statement.exe");
  assert.equal(wrongName.update?.processingStatus, "SKIPPED");
  assert.equal(wrongName.update?.errorCode, "UNSUPPORTED_FILE_TYPE");
  const wrongMime = await runPdf(new Response(Buffer.from("%PDF-1.7"), { status: 200, headers: { "content-type": "image/png" } }));
  assert.equal(wrongMime.update?.errorCode, "UNSUPPORTED_MIME_TYPE");
  const wrongSignature = await runPdf(new Response(Buffer.from("not pdf"), { status: 200, headers: { "content-type": "application/pdf" } }));
  assert.equal(wrongSignature.update?.errorCode, "PDF_SIGNATURE_INVALID");
  const oversized = await runPdf(new Response(Buffer.from("%PDF-1.7\n123"), { status: 200, headers: { "content-type": "application/pdf" } }), "statement.pdf", "10");
  assert.equal(oversized.update?.errorCode, "MEDIA_TOO_LARGE");
  const declaredOversized = await runPdf(new Response(Buffer.from("%PDF-1.7"), { status: 200, headers: { "content-type": "application/pdf" } }), "statement.pdf", "1024", 2048);
  assert.equal(declaredOversized.update?.errorCode, "MEDIA_TOO_LARGE");
});

void test("inbound PDF download failures remain FAILED and do not throw", async () => {
  const result = await runPdf(new Response(null, { status: 410 }));
  assert.equal(result.update?.processingStatus, "FAILED");
  assert.equal(result.update?.errorCode, "LINE_HTTP_410");
});

import { join } from "node:path";

void test("access token is never written by the media service", () => {
  const source = readFileSync(join(__dirname, "line-image.service.ts"), "utf8");
  assert.doesNotMatch(source, /logger\.(log|warn|error).*accessToken/);
});
