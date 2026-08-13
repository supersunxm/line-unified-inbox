import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { MassMessageService } from "./mass-message.service";
import type {
  MassMessageCreateInput,
  MassMessagePreviewInput,
} from "./mass-message.types";

@Controller("mass-messages")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class MassMessageController {
  constructor(private readonly service: MassMessageService) {}

  @Post("upload-image")
  @UseInterceptors(FileInterceptor("file"))
  async uploadImage(
    @UploadedFile() file: { buffer: Buffer; mimetype?: string; size?: number } | undefined,
    @Req() req: AuthRequest,
  ) {
    if (!file || !file.buffer) {
      throw new BadRequestException("Image file is required");
    }
    return this.service.uploadImage(file, req.user!);
  }

  @Post("preview")
  async preview(
    @Body() body: MassMessagePreviewInput,
    @Req() req: AuthRequest,
  ) {
    return this.service.preview(body, req.user!);
  }

  @Post()
  async createAndSend(
    @Body() body: MassMessageCreateInput,
    @Req() req: AuthRequest,
  ) {
    return this.service.createAndSend(body, req.user!);
  }

  @Get(":id")
  async getCampaign(
    @Param("id") id: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.getCampaign(id, req.user!);
  }

  @Get()
  async listCampaigns(
    @Query("limit") limit = "20",
    @Query("offset") offset = "0",
    @Req() req: AuthRequest,
  ) {
    const parsedLimit = Number.parseInt(limit, 10) || 20;
    const parsedOffset = Number.parseInt(offset, 10) || 0;
    return this.service.listCampaigns(parsedLimit, parsedOffset, req.user!);
  }
}
