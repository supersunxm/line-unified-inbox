import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { BroadcastService } from "./broadcast.service";
import type {
  BroadcastCreateInput,
  BroadcastDraftInput,
  BroadcastPreviewInput,
} from "./broadcast.types";

@Controller("broadcasts")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class BroadcastController {
  constructor(private readonly service: BroadcastService) {}

  @Post("preview")
  preview(@Body() body: BroadcastPreviewInput, @Req() req: AuthRequest) {
    return this.service.preview(body, req.user!);
  }

  @Post("draft")
  saveDraft(@Body() body: BroadcastDraftInput, @Req() req: AuthRequest) {
    return this.service.saveDraft(body, req.user!);
  }

  @Post()
  createAndSend(@Body() body: BroadcastCreateInput, @Req() req: AuthRequest) {
    return this.service.createAndSend(body, req.user!);
  }

  @Post(":id/retry-failed")
  retryFailed(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.service.retryFailed(id, req.user!);
  }

  @Get(":id")
  getCampaign(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.service.getCampaign(id, req.user!);
  }

  @Get()
  listCampaigns(
    @Query("limit") limit = "20",
    @Query("offset") offset = "0",
    @Req() req: AuthRequest,
  ) {
    return this.service.listCampaigns(
      Number.parseInt(limit, 10) || 20,
      Number.parseInt(offset, 10) || 0,
      req.user!,
    );
  }
}
