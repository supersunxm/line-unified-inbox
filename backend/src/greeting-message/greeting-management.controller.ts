import { Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { Roles } from "../auth/auth.decorators";
import { AuthGuard, type AuthRequest } from "../auth/auth.guard";
import { GreetingManagementService } from "./greeting-management.service";

@Controller("greeting-messages")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class GreetingManagementController {
  constructor(private readonly management: GreetingManagementService) {}

  @Get(":id/history")
  history(@Param("id") id: string) {
    return this.management.history(id);
  }

  @Post(":id/duplicate")
  duplicate(@Param("id") id: string, @Req() req: AuthRequest) {
    return this.management.duplicate(id, req.user);
  }
}
