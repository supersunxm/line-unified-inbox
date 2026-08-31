import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { StoreAccessService } from "../auth/store-access.service";
import { createMediaPublicUrl } from "./media-public-url";
import { MediaController } from "./media.controller";
import { MediaStorageService } from "./media-storage";

function signedQuery(key: string) {
  const parsed = new URL(createMediaPublicUrl(key));
  return {
    key: parsed.searchParams.get("key"),
    expires: parsed.searchParams.get("expires"),
    signature: parsed.searchParams.get("signature"),
  };
}

void test("public MP4 media supports HTTP byte range requests for LINE playback", async () => {
  const video = Buffer.from("0123456789");
  const storage = {
    get: () => Promise.resolve({ body: video, contentType: "video/mp4" }),
  } as unknown as MediaStorageService;
  const controller = new MediaController(
    {} as PrismaService,
    storage,
    {} as StoreAccessService,
  );

  const headers = new Map<string, string>();
  let statusCode = 200;
  let sent = Buffer.alloc(0);
  const response = {
    setHeader: (key: string, value: string) => headers.set(key, value),
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    send: (body: Buffer) => {
      sent = body;
    },
  };

  await controller.publicMedia(
    {
      query: signedQuery("line-media/outbound/conversation/video.mp4"),
      headers: { range: "bytes=2-5" },
    } as never,
    response as never,
  );

  assert.equal(statusCode, 206);
  assert.equal(headers.get("Accept-Ranges"), "bytes");
  assert.equal(headers.get("Content-Type"), "video/mp4");
  assert.equal(headers.get("Content-Range"), "bytes 2-5/10");
  assert.equal(headers.get("Content-Length"), "4");
  assert.equal(sent.toString(), "2345");
});

void test("public MP4 media returns 416 for an unsatisfiable range", async () => {
  const video = Buffer.from("0123456789");
  const storage = {
    get: () => Promise.resolve({ body: video, contentType: "video/mp4" }),
  } as unknown as MediaStorageService;
  const controller = new MediaController(
    {} as PrismaService,
    storage,
    {} as StoreAccessService,
  );

  const headers = new Map<string, string>();
  let statusCode = 200;
  let sent = Buffer.from("unexpected");
  const response = {
    setHeader: (key: string, value: string) => headers.set(key, value),
    status: (code: number) => {
      statusCode = code;
      return response;
    },
    send: (body: Buffer) => {
      sent = body;
    },
  };

  await controller.publicMedia(
    {
      query: signedQuery("line-media/outbound/conversation/video.mp4"),
      headers: { range: "bytes=99-100" },
    } as never,
    response as never,
  );

  assert.equal(statusCode, 416);
  assert.equal(headers.get("Content-Range"), "bytes */10");
  assert.equal(headers.get("Content-Length"), "0");
  assert.equal(sent.length, 0);
});
