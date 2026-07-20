import { Controller, Get, NotFoundException, Param, Res } from "@nestjs/common";
import { Response } from "express";
import { Roles } from "../auth/auth.decorators";
import { PrismaService } from "../prisma.service";
import { MediaStorageService } from "./media-storage";

@Controller("messages")
export class MediaController {
  constructor(private readonly prisma: PrismaService, private readonly storage: MediaStorageService) {}

  @Roles("ADMIN")
  @Get(":messageId/media")
  async get(@Param("messageId") messageId: string, @Res() response: Response) {
    const media = await this.prisma.messageMedia.findUnique({ where: { messageId }, include: { message: { select: { conversation: { select: { lineOfficialAccountId: true } } } } } });
    if (!media || media.processingStatus !== "READY" || !media.objectKey || !media.mimeType) throw new NotFoundException("Message media is unavailable");
    const stored = await this.storage.get(media.objectKey);
    response.setHeader("Content-Type", media.mimeType);
    response.setHeader("Content-Length", String(stored.body.length));
    response.setHeader("Cache-Control", "private, max-age=3600");
    response.setHeader("Content-Disposition", "inline");
    response.send(stored.body);
  }
}
