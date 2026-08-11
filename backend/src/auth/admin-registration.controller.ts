import { Controller, Get, Param, Patch, Req } from "@nestjs/common";
import { Roles } from "./auth.decorators";
import { AuthRequest } from "./auth.guard";
import { RegistrationService } from "./registration.service";

@Controller("admin/registrations")
@Roles("ADMIN")
export class AdminRegistrationController {
  constructor(private readonly registration: RegistrationService) {}
  @Get("pending") async pending() { return { registrations: await this.registration.pending() }; }
  @Patch(":id/approve") approve(@Param("id") id: string, @Req() request: AuthRequest) { return this.registration.approve(id, request.user!.id, request.ip, request.get("user-agent")); }
  @Patch(":id/reject") reject(@Param("id") id: string, @Req() request: AuthRequest) { return this.registration.reject(id, request.user!.id, request.ip, request.get("user-agent")); }
}
