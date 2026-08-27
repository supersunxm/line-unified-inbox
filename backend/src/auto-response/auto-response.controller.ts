import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AutoResponseStatus, UserRole } from "@prisma/client";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { AutoResponseService } from "./auto-response.service";
import type {
  AutoResponsePreviewDto,
  CreateAutoResponseDto,
  UpdateAutoResponseDto,
} from "./auto-response.types";

@Controller("auto-responses")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AutoResponseController {
  constructor(private readonly service: AutoResponseService) {}

  @Get()
  async listRules(
    @Query("status") status?: AutoResponseStatus,
    @Query("search") search?: string,
  ) {
    return this.service.listRules({ status, search });
  }

  @Post()
  async createRule(
    @Body() body: CreateAutoResponseDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.createRule(body, req.user!);
  }

  @Get(":id")
  async getRule(@Param("id") id: string) {
    return this.service.getRule(id);
  }

  @Patch(":id")
  async updateRule(
    @Param("id") id: string,
    @Body() body: UpdateAutoResponseDto,
    @Req() req: AuthRequest,
  ) {
    return this.service.updateRule(id, body, req.user!);
  }

  @Post(":id/activate")
  async activateRule(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.service.activateRule(id, req.user!);
  }

  @Post(":id/deactivate")
  async deactivateRule(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.service.deactivateRule(id, req.user!);
  }

  @Post(":id/archive")
  async archiveRule(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.service.archiveRule(id, req.user!);
  }

  @Get(":id/usage")
  async getRuleUsage(@Param("id") id: string) {
    return this.service.getRuleUsage(id);
  }

  @Post(":id/preview")
  async previewRule(
    @Param("id") id: string,
    @Body() body?: AutoResponsePreviewDto,
  ) {
    return this.service.previewRule(id, body);
  }
}
