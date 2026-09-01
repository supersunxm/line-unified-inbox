import assert from "node:assert/strict";
import test from "node:test";
import {
  createVideoPlaceholderPng,
  createVideoPreviewPng,
  getMp4DisplayDimensions,
  getPreviewDimensions,
} from "./mobile-video-preview";

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

function mp4WithTkhd(
  width: number,
  height: number,
  quarterTurn = false,
): Buffer {
  return Buffer.concat([
    Buffer.alloc(4),
    Buffer.from("ftypisom", "ascii"),
    Buffer.alloc(12),
    tkhd(width, height, quarterTurn),
  ]);
}

function pngDimensions(buffer: Buffer): { width: number; height: number } {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(buffer.subarray(0, 8).equals(signature));
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR");
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
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

test("creates a valid PNG placeholder with requested dimensions", () => {
  const preview = createVideoPlaceholderPng(180, 320);
  assert.deepEqual(pngDimensions(preview), { width: 180, height: 320 });
});

test("creates a 9:16 preview for a rotated portrait MP4", async () => {
  const fallback = createVideoPlaceholderPng(320, 180);
  const preview = await createVideoPreviewPng(
    mp4WithTkhd(1920, 1080, true),
    fallback,
  );

  assert.deepEqual(pngDimensions(preview), { width: 180, height: 320 });
});

test("returns fallback when MP4 display dimensions cannot be read", async () => {
  const fallback = createVideoPlaceholderPng(320, 180);
  const preview = await createVideoPreviewPng(
    Buffer.from("not-an-mp4", "utf8"),
    fallback,
  );

  assert.strictEqual(preview, fallback);
});
