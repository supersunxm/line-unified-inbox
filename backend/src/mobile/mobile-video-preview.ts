import sharp from "sharp";

export type VideoDisplayDimensions = {
  width: number;
  height: number;
};

const FIXED_POINT_SCALE = 65_536;
const PREVIEW_MAX_SIDE = 320;

function readFixed16(buffer: Buffer, offset: number): number {
  return buffer.readInt32BE(offset) / FIXED_POINT_SCALE;
}

function readUnsignedFixed16(buffer: Buffer, offset: number): number {
  return buffer.readUInt32BE(offset) / FIXED_POINT_SCALE;
}

export function getMp4DisplayDimensions(buffer: Buffer): VideoDisplayDimensions | null {
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
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) continue;

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

export async function createVideoPreviewPng(
  videoBuffer: Buffer,
  fallbackPreviewPng: Buffer,
): Promise<Buffer> {
  const videoDimensions = getMp4DisplayDimensions(videoBuffer);
  if (!videoDimensions) return fallbackPreviewPng;

  const preview = getPreviewDimensions(videoDimensions);
  return sharp(fallbackPreviewPng)
    .resize(preview.width, preview.height, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
}
