import { deflateSync } from "node:zlib";

export type VideoDisplayDimensions = {
  width: number;
  height: number;
};

const FIXED_POINT_SCALE = 65_536;
const PREVIEW_MAX_SIDE = 320;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function readFixed16(buffer: Buffer, offset: number): number {
  return buffer.readInt32BE(offset) / FIXED_POINT_SCALE;
}

function readUnsignedFixed16(buffer: Buffer, offset: number): number {
  return buffer.readUInt32BE(offset) / FIXED_POINT_SCALE;
}

export function getMp4DisplayDimensions(
  buffer: Buffer,
): VideoDisplayDimensions | null {
  let searchOffset = 0;

  while (searchOffset < buffer.length) {
    const typeOffset = buffer.indexOf("tkhd", searchOffset, "ascii");
    if (typeOffset < 0) return null;
    searchOffset = typeOffset + 4;

    const boxStart = typeOffset - 4;
    if (boxStart < 0 || boxStart + 12 > buffer.length) continue;

    const boxSize = buffer.readUInt32BE(boxStart);
    if (boxSize < 92 || boxStart + boxSize > buffer.length) continue;

    const version = buffer[boxStart + 8];
    if (version !== 0 && version !== 1) continue;

    const matrixOffset = boxStart + (version === 1 ? 60 : 48);
    const widthOffset = boxStart + (version === 1 ? 96 : 84);
    const heightOffset = widthOffset + 4;
    if (heightOffset + 4 > boxStart + boxSize) continue;

    const width = readUnsignedFixed16(buffer, widthOffset);
    const height = readUnsignedFixed16(buffer, heightOffset);
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      continue;
    }

    const a = readFixed16(buffer, matrixOffset);
    const b = readFixed16(buffer, matrixOffset + 4);
    const c = readFixed16(buffer, matrixOffset + 12);
    const d = readFixed16(buffer, matrixOffset + 16);
    const quarterTurn =
      Math.abs(a) < 0.5 &&
      Math.abs(d) < 0.5 &&
      Math.abs(b) > 0.5 &&
      Math.abs(c) > 0.5;

    return quarterTurn
      ? { width: Math.round(height), height: Math.round(width) }
      : { width: Math.round(width), height: Math.round(height) };
  }

  return null;
}

export function getPreviewDimensions(
  video: VideoDisplayDimensions,
  maxSide = PREVIEW_MAX_SIDE,
): VideoDisplayDimensions {
  if (video.width >= video.height) {
    return {
      width: maxSide,
      height: Math.max(1, Math.round((maxSide * video.height) / video.width)),
    };
  }
  return {
    width: Math.max(1, Math.round((maxSide * video.width) / video.height)),
    height: maxSide,
  };
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.allocUnsafe(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

export function createVideoPlaceholderPng(width: number, height: number): Buffer {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1
  ) {
    throw new Error("Invalid preview dimensions");
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = 1 + width * 3;
  const row = Buffer.alloc(stride, 24);
  row[0] = 0;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y += 1) {
    row.copy(raw, y * stride);
  }

  return Buffer.concat([
    PNG_SIGNATURE,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export function createVideoPreviewPng(
  videoBuffer: Buffer,
  fallbackPreviewPng: Buffer,
): Promise<Buffer> {
  const videoDimensions = getMp4DisplayDimensions(videoBuffer);
  if (!videoDimensions) return Promise.resolve(fallbackPreviewPng);

  const preview = getPreviewDimensions(videoDimensions);
  try {
    return Promise.resolve(
      createVideoPlaceholderPng(preview.width, preview.height),
    );
  } catch {
    return Promise.resolve(fallbackPreviewPng);
  }
}
