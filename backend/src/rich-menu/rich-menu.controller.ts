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
import { memoryStorage } from "multer";
import { UserRole } from "@prisma/client";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { RichMenuService } from "./rich-menu.service";
import type {
  CreateRichMenuTemplateDto,
  PublishBulkDto,
  PublishCanaryDto,
  RichMenuPreviewInputDto,
  SaveAssignmentsDto,
  UpdateRichMenuTemplateDto,
} from "./rich-menu.types";

@Controller("rich-menu")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class RichMenuController {
  constructor(private readonly service: RichMenuService) {}

  @Get("publish-capabilities")
  async getPublishCapabilities() {
    return this.service.getPublishCapabilities();
  }

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

  @Post("templates/:id/publish-canary")
  async publishCanary(
    @Param("id") id: string,
    @Body() body: PublishCanaryDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.publishCanary(id, body, req.user!);
  }

  @Post("templates/:id/publish-bulk")
  async publishBulk(
    @Param("id") id: string,
    @Body() body: PublishBulkDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.createBulkPublishJob(id, body, req.user!);
  }

  @Get("templates/:id/publish-jobs")
  async listPublishJobs(@Param("id") id: string) {
    return this.service.listPublishJobs(id);
  }

  @Get("publish-jobs/:jobId")
  async getPublishJob(@Param("jobId") jobId: string) {
    return this.service.getPublishJob(jobId);
  }

  @Post("publish-jobs/:jobId/cancel")
  async cancelPublishJob(
    @Param("jobId") jobId: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.cancelPublishJob(jobId, req.user!);
  }

  @Post("publish-jobs/:jobId/retry-failed")
  async retryFailedJob(
    @Param("jobId") jobId: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.retryFailedJobAttempts(jobId, req.user!);
  }

  @Get("templates/:id/publish-attempts")
  async getPublishAttempts(@Param("id") id: string) {
    return this.service.getPublishAttempts(id);
  }

  @Get("publish-attempts/:attemptId")
  async getPublishAttempt(@Param("attemptId") attemptId: string) {
    return this.service.getPublishAttempt(attemptId);
  }

  @Post("publish-attempts/:attemptId/retry")
  async retryPublish(
    @Param("attemptId") attemptId: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.retryPublish(attemptId, req.user!);
  }

  @Post("publish-attempts/:attemptId/rollback")
  async rollbackPublish(
    @Param("attemptId") attemptId: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.rollbackPublish(attemptId, req.user!);
  }

  @Post("upload-image")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: {
        fileSize: 1 * 1024 * 1024,
      },
    }),
  )
  async uploadImage(
    @UploadedFile()
    file:
      | {
          buffer: Buffer;
          originalname?: string;
          mimetype?: string;
          size?: number;
        }
      | undefined,
    @Body("preset") preset: string | undefined,
  ) {
    if (!file || !file.buffer || !file.buffer.length) {
      throw new BadRequestException("Image file is required and cannot be empty");
    }
    return this.service.uploadImage(file as any, preset);
  }

  @Post("accounts/:lineOfficialAccountId/clear-default")
  async clearDefaultRichMenu(
    @Param("lineOfficialAccountId") lineOfficialAccountId: string,
    @Req() req: AuthRequest,
  ) {
    return this.service.clearDefaultRichMenu(lineOfficialAccountId, req.user!);
  }

  @Get("accounts/:lineOfficialAccountId/current-state")
  async getStoreCurrentState(
    @Param("lineOfficialAccountId") lineOfficialAccountId: string,
  ) {
    return this.service.getStoreCurrentState(lineOfficialAccountId);
  }
}
