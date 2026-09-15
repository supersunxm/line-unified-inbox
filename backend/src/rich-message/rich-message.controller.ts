import {
  Body,
  Controller,
  Get,
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
import { RichMessageService } from "./rich-message.service";
import type { CreateRichMessageDto, UpdateRichMessageDto } from "./rich-message.types";

@Controller("rich-messages")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class RichMessageController {
  constructor(private readonly richMessages: RichMessageService) {}

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
    const image = await this.richMessages.renderImagemapImage(id, expires, signature, size);
    response.setHeader("Content-Type", image.contentType);
    response.setHeader("Content-Length", String(image.body.length));
    response.setHeader("Cache-Control", "public, max-age=604800, immutable");
    response.setHeader("Content-Disposition", "inline");
    response.send(image.body);
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
