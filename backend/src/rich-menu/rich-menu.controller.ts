import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { UserRole } from "@prisma/client";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { RichMenuService } from "./rich-menu.service";
import type {
  CreateRichMenuTemplateDto,
  RichMenuPreviewInputDto,
  SaveAssignmentsDto,
  UpdateRichMenuTemplateDto,
} from "./rich-menu.types";

@Controller("rich-menu")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class RichMenuController {
  constructor(private readonly service: RichMenuService) {}

  @Get("templates")
  async listTemplates() {
    return this.service.listTemplates();
  }

  @Post("templates")
  async createTemplate(
    @Body() body: CreateRichMenuTemplateDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.createTemplate(body, req.user!);
  }

  @Get("templates/:id")
  async getTemplate(@Param("id") id: string) {
    return this.service.getTemplate(id);
  }

  @Patch("templates/:id")
  async updateTemplate(
    @Param("id") id: string,
    @Body() body: UpdateRichMenuTemplateDto,
  ) {
    return this.service.updateTemplate(id, body);
  }

  @Delete("templates/:id")
  async deleteTemplate(@Param("id") id: string) {
    return this.service.deleteTemplate(id);
  }

  @Post("templates/:id/preview")
  async previewTemplate(
    @Param("id") id: string,
    @Body() body: RichMenuPreviewInputDto,
  ) {
    return this.service.preview(id, body);
  }

  @Get("templates/:id/readiness")
  async evaluateReadiness(@Param("id") id: string) {
    return this.service.evaluateReadiness(id);
  }

  @Post("templates/:id/assignments")
  async saveAssignments(
    @Param("id") id: string,
    @Body() body: SaveAssignmentsDto,
  ) {
    return this.service.saveAssignments(id, body);
  }

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
}
