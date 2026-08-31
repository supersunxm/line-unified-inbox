import assert from "node:assert/strict";
import test from "node:test";
import { isSupportedMp4, MOBILE_VIDEO_MAX_BYTES } from "./mobile-video.service";

test("mobile video accepts MP4 ftyp containers", () => {
  const buffer = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypisom"), Buffer.alloc(32)]);
  assert.equal(isSupportedMp4(buffer), true);
});

test("mobile video rejects QuickTime and non-MP4 containers", () => {
  const quickTime = Buffer.concat([Buffer.alloc(4), Buffer.from("ftypqt  "), Buffer.alloc(32)]);
  assert.equal(isSupportedMp4(quickTime), false);
  assert.equal(isSupportedMp4(Buffer.from("not-an-mp4")), false);
});

test("mobile video upload limit is 30 MB", () => {
  assert.equal(MOBILE_VIDEO_MAX_BYTES, 30 * 1024 * 1024);
});
