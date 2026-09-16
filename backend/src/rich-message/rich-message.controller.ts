import {
  Body,
  Controller,
  Get,
  Logger,
  NotFoundException,
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
      // NotFoundException covers invalid/expired signatures, unsupported sizes,
      // missing records, and unavailable source media. Never bypass those checks.
      if (error instanceof NotFoundException) throw error;

      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[RichMessage] imagemap transform failed for id=${id} size=${size}; falling back to stored source: ${detail}`,
      );

      // At this point renderImagemapImage() already passed signature/expiry and
      // source-media checks; the remaining common failure is image transformation
      // (e.g. sharp/native codec). Serve the stored source instead of returning 500
      // so LINE can still display the imagemap and keep MESSAGE tap actions usable.
      const richMessage = await this.richMessages.get(id);
      const stored = await this.storage.get(richMessage.mediaObjectKey);
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
