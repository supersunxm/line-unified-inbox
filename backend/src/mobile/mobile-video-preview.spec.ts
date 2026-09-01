import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import {
  createVideoPreviewPng,
  getMp4DisplayDimensions,
  getPreviewDimensions,
} from "./mobile-video-preview";

const requireFromHere = createRequire(__filename);
const sharp = requireFromHere("sharp") as typeof import("sharp");

function tkhd(width: number, height: number, quarterTurn = false): Buffer {
  const box = Buffer.alloc(92);
  box.writeUInt32BE(box.length, 0);
  box.write("tkhd", 4, 4, "ascii");
  box[8] = 0;

  const matrixOffset = 48;
  box.writeInt32BE(quarterTurn ? 0 : 65_536, matrixOffset);
  box.writeInt32BE(quarterTurn ? 65_536 : 0, matrixOffset + 4);
  box.writeInt32BE(0, matrixOffset + 8);
  box.writeInt32BE(quarterTurn ? -65_536 : 0, matrixOffset + 12);
  box.writeInt32BE(quarterTurn ? 0 : 65_536, matrixOffset + 16);
  box.writeInt32BE(0, matrixOffset + 20);
  box.writeInt32BE(0, matrixOffset + 24);
  box.writeInt32BE(0, matrixOffset + 28);
  box.writeInt32BE(0x40000000, matrixOffset + 32);
  box.writeUInt32BE(width * 65_536, 84);
  box.writeUInt32BE(height * 65_536, 88);
  return box;
}

function mp4WithTkhd(width: number, height: number, quarterTurn = false): Buffer {
  return Buffer.concat([
    Buffer.alloc(4),
    Buffer.from("ftypisom", "ascii"),
    Buffer.alloc(12),
    tkhd(width, height, quarterTurn),
  ]);
}

test("reads landscape MP4 display dimensions", () => {
  assert.deepEqual(getMp4DisplayDimensions(mp4WithTkhd(1920, 1080)), {
    width: 1920,
    height: 1080,
  });
});

test("applies MP4 track rotation to portrait display dimensions", () => {
  assert.deepEqual(getMp4DisplayDimensions(mp4WithTkhd(1920, 1080, true)), {
    width: 1080,
    height: 1920,
  });
});

test("preview dimensions preserve the source aspect ratio", () => {
  assert.deepEqual(getPreviewDimensions({ width: 1080, height: 1920 }), {
    width: 180,
    height: 320,
  });
  assert.deepEqual(getPreviewDimensions({ width: 1920, height: 1080 }), {
    width: 320,
    height: 180,
  });
});

test("creates a 9:16 preview for a rotated portrait MP4", async () => {
  const fallback = await sharp({
    create: {
      width: 320,
      height: 180,
      channels: 3,
      background: { r: 20, g: 30, b: 25 },
    },
  })
    .png()
    .toBuffer();

  const preview = await createVideoPreviewPng(
    mp4WithTkhd(1920, 1080, true),
    fallback,
  );
  const metadata = await sharp(preview).metadata();

  assert.equal(metadata.width, 180);
  assert.equal(metadata.height, 320);
});
