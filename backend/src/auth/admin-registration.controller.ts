import { Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { Roles } from "./auth.decorators";
import { AuthRequest } from "./auth.guard";
import { RegistrationService } from "./registration.service";
import { AuthService } from "./auth.service";

@Controller("admin/registrations")
@Roles("ADMIN")
export class AdminRegistrationController {
  constructor(private readonly registration: RegistrationService, private readonly auth: AuthService) {}
  @Get("pending") async pending() { return { registrations: await this.registration.pending() }; }
  @Get("approved") async approved() { return { accounts: await this.registration.approved() }; }
  @Patch(":id/approve") approve(@Param("id") id: string, @Req() request: AuthRequest) { return this.registration.approve(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Patch(":id/reject") reject(@Param("id") id: string, @Req() request: AuthRequest) { return this.registration.reject(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Post("users/:id/reset-password") resetPassword(@Param("id") id: string, @Req() request: AuthRequest) { return this.auth.resetPassword(id, request.user!.id, request.ip, request.get("user-agent")); }
}
