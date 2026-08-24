import { Controller, Get, NotFoundException, Param, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { AuthRequest } from "../auth/auth.guard";
import { Public } from "../auth/auth.decorators";
import { verifyMediaPublicUrl } from "./media-public-url";
import { StoreAccessService } from "../auth/store-access.service";
import { PrismaService } from "../prisma.service";
import { MediaStorageService } from "./media-storage";

@Controller("messages")
export class MediaController {
  constructor(private readonly prisma: PrismaService, private readonly storage: MediaStorageService, private readonly storeAccess: StoreAccessService) {}

  @Get(":messageId/media")
  async get(@Param("messageId") messageId: string, @Req() request: AuthRequest, @Res() response: Response) {
    const media = await this.prisma.messageMedia.findUnique({ where: { messageId }, include: { message: { select: { conversation: { select: { storeId: true } } } } } });
    if (!media || media.processingStatus !== "READY" || (!media.objectKey && !media.fileId) || !media.mimeType) throw new NotFoundException("Message media is unavailable");
    if (!media.message.conversation.storeId) throw new NotFoundException("Message media is unavailable");
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
    if (!key.startsWith("line-media/outbound/") || !verifyMediaPublicUrl(key, expires, signature)) throw new NotFoundException("Media is unavailable");
    try {
      const stored = await this.storage.get(key);
      response.setHeader("Content-Type", stored.contentType ?? "application/octet-stream");
      response.setHeader("Cache-Control", "private, max-age=300");
      response.setHeader("Content-Disposition", "inline");
      response.send(stored.body);
    } catch { throw new NotFoundException("Media is unavailable"); }
  }
}
