import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { GreetingTemplateStatus, UserRole } from "@prisma/client";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { GreetingMessageService } from "./greeting-message.service";
import {
  CreateGreetingTemplateDto,
  GreetingAssignStoresDto,
  GreetingPreviewDto,
  UpdateGreetingTemplateDto,
} from "./greeting-message.types";

@Controller("greeting-messages")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class GreetingMessageController {
  constructor(private readonly greetingService: GreetingMessageService) {}

  @Get()
  async listTemplates(
    @Query("status") status?: GreetingTemplateStatus,
    @Query("search") search?: string,
  ) {
    return this.greetingService.listTemplates({ status, search });
  }

  @Post()
  async createTemplate(
    @Body() dto: CreateGreetingTemplateDto,
    @Req() req: AuthRequest,
  ) {
    return this.greetingService.createTemplate(dto, req.user);
  }

  @Post("media")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    }),
  )
  async uploadMedia(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthRequest,
  ) {
    return this.greetingService.uploadMedia(file, req.user);
  }

  @Get(":id")
  async getTemplate(@Param("id") id: string) {
    return this.greetingService.getTemplate(id);
  }

  @Patch(":id")
  async updateTemplate(
    @Param("id") id: string,
    @Body() dto: UpdateGreetingTemplateDto,
    @Req() req: AuthRequest,
  ) {
    return this.greetingService.updateTemplate(id, dto, req.user);
  }

  @Post(":id/activate")
  async activateTemplate(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.greetingService.activateTemplate(id, req.user);
  }

  @Post(":id/deactivate")
  async deactivateTemplate(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.greetingService.deactivateTemplate(id, req.user);
  }

  @Post(":id/archive")
  async archiveTemplate(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.greetingService.archiveTemplate(id, req.user);
  }

  @Get(":id/readiness")
  async getReadiness(@Param("id") id: string) {
    return this.greetingService.getReadiness(id);
  }

  @Post(":id/assignments")
  async assignStores(
    @Param("id") id: string,
    @Body() dto: GreetingAssignStoresDto,
    @Req() req: AuthRequest,
  ) {
    return this.greetingService.assignStores(id, dto, req.user);
  }

  @Post(":id/preview")
  async preview(@Param("id") id: string, @Body() dto?: GreetingPreviewDto) {
    return this.greetingService.preview(id, dto);
  }
}
