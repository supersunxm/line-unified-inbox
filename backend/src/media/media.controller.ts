import { Controller, Get, NotFoundException, Param, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { AuthRequest } from "../auth/auth.guard";
import { Public } from "../auth/auth.decorators";
import { isAllowedPublicMediaObjectKey, verifyMediaPublicUrl } from "./media-public-url";
import { StoreAccessService } from "../auth/store-access.service";
import { PrismaService } from "../prisma.service";
import { MediaStorageService } from "./media-storage";

function resolveMediaContentType(key: string, storedContentType?: string): string {
  if (storedContentType && storedContentType !== "application/octet-stream") {
    return storedContentType;
  }
  const lower = key.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".mp4")) return "video/mp4";
  return storedContentType ?? "application/octet-stream";
}

type ByteRange = { start: number; end: number };

function parseSingleByteRange(header: string | undefined, size: number): ByteRange | null | "invalid" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match || size <= 0) return "invalid";

  const startText = match[1];
  const endText = match[2];
  if (!startText && !endText) return "invalid";

  if (!startText) {
    const suffixLength = Number(endText);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return "invalid";
    const start = Math.max(0, size - suffixLength);
    return { start, end: size - 1 };
  }

  const start = Number(startText);
  if (!Number.isSafeInteger(start) || start < 0 || start >= size) return "invalid";

  let end = endText ? Number(endText) : size - 1;
  if (!Number.isSafeInteger(end) || end < start) return "invalid";
  end = Math.min(end, size - 1);
  return { start, end };
}

function sendPublicMedia(response: Response, body: Buffer, contentType: string, rangeHeader?: string) {
  response.setHeader("Content-Type", contentType);
  response.setHeader("Accept-Ranges", "bytes");
  response.setHeader("Cache-Control", "private, max-age=300");
  response.setHeader("Content-Disposition", "inline");

  const range = parseSingleByteRange(rangeHeader, body.length);
  if (range === "invalid") {
    response.status(416);
    response.setHeader("Content-Range", `bytes */${body.length}`);
    response.setHeader("Content-Length", "0");
    response.send(Buffer.alloc(0));
    return;
  }

  if (range) {
    const partial = body.subarray(range.start, range.end + 1);
    response.status(206);
    response.setHeader("Content-Range", `bytes ${range.start}-${range.end}/${body.length}`);
    response.setHeader("Content-Length", String(partial.length));
    response.send(partial);
    return;
  }

  response.setHeader("Content-Length", String(body.length));
  response.send(body);
}

@Controller("messages")
export class MediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: MediaStorageService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  @Get(":messageId/media")
  async get(@Param("messageId") messageId: string, @Req() request: AuthRequest, @Res() response: Response) {
    const media = await this.prisma.messageMedia.findUnique({
      where: { messageId },
      include: { message: { select: { conversation: { select: { storeId: true } } } } },
    });
    if (!media || media.processingStatus !== "READY" || (!media.objectKey && !media.fileId) || !media.mimeType) {
      throw new NotFoundException("Message media is unavailable");
    }
    if (!media.message.conversation.storeId) {
      throw new NotFoundException("Message media is unavailable");
    }
    await this.storeAccess.assertStoreAccess(request.user!, media.message.conversation.storeId);
    const stored = await this.storage.get(media.fileId ?? media.objectKey!);
    response.setHeader("Content-Type", media.mimeType);
    response.setHeader("Content-Length", String(stored.body.length));
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.setHeader("Content-Disposition", "inline");
    response.send(stored.body);
  }

  @Public()
  @Get("media/public")
  async publicMedia(@Req() request: AuthRequest, @Res() response: Response) {
    const key = typeof request.query.key === "string" ? request.query.key : "";
    const expires = typeof request.query.expires === "string" ? request.query.expires : "";
    const signature = typeof request.query.signature === "string" ? request.query.signature : "";

    if (!isAllowedPublicMediaObjectKey(key) || !verifyMediaPublicUrl(key, expires, signature)) {
      throw new NotFoundException("Media is unavailable");
    }

    try {
      const stored = await this.storage.get(key);
      const contentType = resolveMediaContentType(key, stored.contentType);
      const rangeHeader = typeof request.headers?.range === "string" ? request.headers.range : undefined;
      sendPublicMedia(response, stored.body, contentType, rangeHeader);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      throw new NotFoundException("Media is unavailable");
    }
  }
}
