import { Injectable } from "@nestjs/common";
import { MessageType } from "@prisma/client";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import { MediaStorageService } from "./media-storage";
import { readMediaStorageEnabled } from "./media-storage.config";

const supportedTypes = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/gif", "gif"], ["image/webp", "webp"]]);

export class MediaProcessingError extends Error {
  constructor(readonly code: string, message: string) { super(message); }
}

@Injectable()
export class LineImageService {
  constructor(private readonly prisma: PrismaService, private readonly encryption: CredentialEncryptionService, private readonly storage: MediaStorageService) {}

  async process(mediaId: string, lineOaId: string, providerMessageId: string, occurredAt: Date) {
    if (!readMediaStorageEnabled()) {
      await this.prisma.messageMedia.update({ where: { id: mediaId }, data: { processingStatus: "SKIPPED", errorCode: "MEDIA_STORAGE_DISABLED", errorMessage: "Inbound image storage is disabled" } });
      return;
    }
    try {
      const oa = await this.prisma.lineOfficialAccount.findUnique({ where: { id: lineOaId }, select: { encryptedChannelAccessToken: true } });
      if (!oa?.encryptedChannelAccessToken) throw new MediaProcessingError("ACCESS_TOKEN_MISSING", "LINE OA access token is not configured");
      let accessToken: string;
      try { accessToken = this.encryption.decrypt(oa.encryptedChannelAccessToken); }
      catch { throw new MediaProcessingError("ACCESS_TOKEN_INVALID", "LINE OA access token could not be decrypted"); }

      const timeoutMs = positiveInteger(process.env.MEDIA_DOWNLOAD_TIMEOUT_MS, 10_000);
      const maxBytes = positiveInteger(process.env.MEDIA_MAX_FILE_SIZE_BYTES, 10 * 1024 * 1024);
      let response: Response;
      try {
        response = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(providerMessageId)}/content`, { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(timeoutMs) });
      } catch { throw new MediaProcessingError("LINE_NETWORK_ERROR", "LINE image download failed or timed out"); }
      console.log(`[MediaStorage] LINE image download status=${response.status} contentType=${response.headers.get("content-type") ?? "unknown"} contentLength=${response.headers.get("content-length") ?? "unknown"}`);
      if (!response.ok) throw new MediaProcessingError(`LINE_HTTP_${response.status}`, `LINE image download returned HTTP ${response.status}`);
      const mimeType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
      const extension = supportedTypes.get(mimeType);
      if (!extension) throw new MediaProcessingError("UNSUPPORTED_MIME_TYPE", "LINE image has an unsupported MIME type");
      const declaredSize = Number(response.headers.get("content-length"));
      if (Number.isFinite(declaredSize) && declaredSize > maxBytes) throw new MediaProcessingError("MEDIA_TOO_LARGE", "LINE image exceeds the configured size limit");
      const body = await readLimitedBody(response, maxBytes);
      const objectKey = objectKeyFor(lineOaId, occurredAt, providerMessageId, extension);
      const stored = await this.storage.put(objectKey, body, mimeType) ?? { provider: "legacy", fileId: objectKey, mimeType, size: body.length };
      await this.prisma.messageMedia.update({ where: { id: mediaId }, data: { processingStatus: "READY", mimeType: stored.mimeType, objectKey: stored.provider === "google-drive" ? null : objectKey, provider: stored.provider, fileId: stored.fileId, fileSize: stored.size, errorCode: null, errorMessage: null } });
    } catch (error) {
      const code = error instanceof MediaProcessingError ? error.code : "STORAGE_ERROR";
      const message = error instanceof Error ? error.message.slice(0, 300) : "Image processing failed";
      await this.prisma.messageMedia.update({ where: { id: mediaId }, data: { processingStatus: "FAILED", errorCode: code, errorMessage: message } });
    }
  }
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function objectKeyFor(lineOaId: string, occurredAt: Date, messageId: string, extension: string) {
  const year = String(occurredAt.getUTCFullYear());
  const month = String(occurredAt.getUTCMonth() + 1).padStart(2, "0");
  const safeMessageId = messageId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `line-media/${lineOaId}/${year}/${month}/${safeMessageId}.${extension}`;
}

async function readLimitedBody(response: Response, maxBytes: number) {
  if (!response.body) throw new MediaProcessingError("EMPTY_MEDIA", "LINE image response body is empty");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new MediaProcessingError("MEDIA_TOO_LARGE", "LINE image exceeds the configured size limit");
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks, total);
}

export const IMAGE_MEDIA_TYPE = MessageType.IMAGE;
