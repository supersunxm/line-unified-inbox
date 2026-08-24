import { Controller, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { Roles } from "./auth.decorators";
import { AuthRequest } from "./auth.guard";
import { RegistrationService } from "./registration.service";
import { HqRegistrationService } from "./hq-registration.service";
import { AuthService } from "./auth.service";

@Controller("admin/registrations")
@Roles("ADMIN")
export class AdminRegistrationController {
  constructor(private readonly registration: RegistrationService, private readonly hqRegistration: HqRegistrationService, private readonly auth: AuthService) {}
  @Get("pending") async pending() { return { registrations: await this.registration.pending() }; }
  @Get("hq-pending") async hqPending() { return { registrations: await this.hqRegistration.pending() }; }
  @Get("approved") async approved() { return { accounts: await this.registration.approved() }; }
  @Patch(":id/approve") approve(@Param("id") id: string, @Req() request: AuthRequest) { return this.registration.approve(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Patch(":id/reject") reject(@Param("id") id: string, @Req() request: AuthRequest) { return this.registration.reject(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Patch("hq-users/:id/approve") approveHq(@Param("id") id: string, @Req() request: AuthRequest) { return this.hqRegistration.approve(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Patch("hq-users/:id/reject") rejectHq(@Param("id") id: string, @Req() request: AuthRequest) { return this.hqRegistration.reject(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Post("users/:id/reset-password") resetPassword(@Param("id") id: string, @Req() request: AuthRequest) { return this.auth.resetPassword(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Patch("users/:id/deactivate") deactivate(@Param("id") id: string, @Req() request: AuthRequest) { return this.registration.deactivateAccount(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Patch("users/:id/reactivate") reactivate(@Param("id") id: string, @Req() request: AuthRequest) { return this.registration.reactivateAccount(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Post("users/:id/permanent-delete") permanentlyDelete(@Param("id") id: string, @Req() request: AuthRequest) { return this.registration.permanentlyDeleteAccount(id, request.user!.id, request.ip, request.get("user-agent")); }
}
