import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { UserRole } from "@prisma/client";
import { Public, Roles } from "../auth/auth.decorators";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { MediaStorageService } from "../media/media-storage";
import { RichMessageService } from "./rich-message.service";
import type { CreateRichMessageDto, UpdateRichMessageDto } from "./rich-message.types";

@Controller("rich-messages")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class RichMessageController {
  private readonly logger = new Logger(RichMessageController.name);

  constructor(
    private readonly richMessages: RichMessageService,
    private readonly storage: MediaStorageService,
  ) {}

  @Get()
  list(
    @Query("search") search?: string,
    @Query("includeInactive") includeInactive?: string,
  ) {
    return this.richMessages.list({
      search,
      includeInactive: includeInactive === "true",
    });
  }

  @Post()
  create(@Body() dto: CreateRichMessageDto, @Req() req: AuthRequest) {
    return this.richMessages.create(dto, req.user);
  }

  @Public()
  @Get("public/:id/image/:expires/:signature/:size")
  async publicImage(
    @Param("id") id: string,
    @Param("expires") expires: string,
    @Param("signature") signature: string,
    @Param("size") sizeParam: string,
    @Res() response: Response,
  ) {
    const size = Number(sizeParam);

    try {
      const image = await this.richMessages.renderImagemapImage(id, expires, signature, size);
      response.setHeader("Content-Type", image.contentType);
      response.setHeader("Content-Length", String(image.body.length));
      response.setHeader("Cache-Control", "public, max-age=604800, immutable");
      response.setHeader("Content-Disposition", "inline");
      response.send(image.body);
      return;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[RichMessage] imagemap resize failed for id=${id} size=${size}; falling back to stored media: ${detail}`,
      );

      // Preserve the signature/expiry checks in RichMessageService. If the normal
      // renderer failed after validation (for example a sharp/native-image issue),
      // serve the original uploaded image so LINE can still render the imagemap
      // instead of returning HTTP 500. This keeps MESSAGE tap actions usable.
      // `get()` is intentionally called here only after renderImagemapImage() has
      // validated the signed public URL.
      const richMessage = await this.richMessages.get(id);
      let stored = await this.storage.get(richMessage.mediaObjectKey).catch(() => null);

      if (!stored && richMessage.previewObjectKey) {
        stored = await this.storage.get(richMessage.previewObjectKey).catch(() => null);
      }

      if (!stored) {
        this.logger.error(
          `[RichMessage] fallback media unavailable for id=${id} mediaObjectKey=${richMessage.mediaObjectKey}`,
        );
        throw error;
      }

      const contentType = stored.contentType || "image/jpeg";
      response.setHeader("Content-Type", contentType);
      response.setHeader("Content-Length", String(stored.body.length));
      response.setHeader("Cache-Control", "public, max-age=604800, immutable");
      response.setHeader("Content-Disposition", "inline");
      response.setHeader("X-Rich-Message-Image-Fallback", "1");
      response.send(stored.body);
    }
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.richMessages.get(id);
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: UpdateRichMessageDto,
    @Req() req: AuthRequest,
  ) {
    return this.richMessages.update(id, dto, req.user);
  }

  @Post(":id/activate")
  activate(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.richMessages.setActive(id, true, req.user);
  }

  @Post(":id/deactivate")
  deactivate(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.richMessages.setActive(id, false, req.user);
  }
}
