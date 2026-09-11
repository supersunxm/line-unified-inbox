import { Controller, Get, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { AuthGuard } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { RichMenuOverviewService } from "./rich-menu-overview.service";

@Controller("rich-menu")
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class RichMenuOverviewController {
  constructor(private readonly service: RichMenuOverviewService) {}

  @Get("overview")
  async getOverview() {
    return this.service.getOverview();
  }
}
