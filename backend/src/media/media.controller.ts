import { Controller, Get, NotFoundException, Param, Req, Res } from "@nestjs/common";
import { Response } from "express";
import { AuthRequest } from "../auth/auth.guard";
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
    await this.storeAccess.assertStoreAccess(request.user!, media.message.conversation.storeId);
    const stored = await this.storage.get(media.fileId ?? media.objectKey!);
    response.setHeader("Content-Type", media.mimeType);
    response.setHeader("Content-Length", String(stored.body.length));
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.setHeader("Content-Disposition", "inline");
    response.send(stored.body);
  }
}
