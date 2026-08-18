import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { CouponExecutionPolicyService } from "./coupon-execution-policy.service";
import { CouponService } from "./coupon.service";
import type { CouponCreateInput, CouponPreviewInput } from "./coupon.types";

@Controller("coupons")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class CouponController {
  constructor(
    private readonly service: CouponService,
    private readonly executionPolicy: CouponExecutionPolicyService,
  ) {}

  @Post("preview")
  preview(@Body() body: CouponPreviewInput, @Req() req: AuthRequest) {
    this.executionPolicy.assertSelection(body.storeSelection);
    return this.service.preview(body, req.user!);
  }

  @Post()
  create(@Body() body: CouponCreateInput, @Req() req: AuthRequest) {
    this.executionPolicy.assertSelection(body.storeSelection);
    return this.service.create(body, req.user!);
  }

  @Post(":id/retry-failed")
  async retryFailed(@Param("id") id: string) {
    await this.executionPolicy.assertCampaign(id);
    return this.service.retryFailed(id);
  }

  @Post(":id/discontinue")
  async discontinue(@Param("id") id: string) {
    await this.executionPolicy.assertCampaign(id);
    return this.service.discontinue(id);
  }

  @Get("execution-mode")
  executionMode() {
    return { mode: this.executionPolicy.getMode() };
  }

  @Get(":id")
  getCampaign(@Param("id") id: string) {
    return this.service.getCampaign(id);
  }

  @Get()
  listCampaigns(@Query("limit") limit = "20", @Query("offset") offset = "0") {
    return this.service.listCampaigns(Number.parseInt(limit, 10) || 20, Number.parseInt(offset, 10) || 0);
  }
}
