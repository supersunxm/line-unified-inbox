import { Controller, Get, Param, Patch, Req } from "@nestjs/common";
import type { AuthRequest } from "../auth/auth.guard";
import { MobileNotificationsService } from "./mobile-notifications.service";

@Controller("mobile/notifications")
export class MobileNotificationsController {
  constructor(private readonly notifications: MobileNotificationsService) {}

  @Get("unread-count")
  unreadCount(@Req() request: AuthRequest) { return this.notifications.unreadCount(request.user!.id); }

  @Patch(":id/read")
  read(@Req() request: AuthRequest, @Param("id") id: string) { return this.notifications.markRead(request.user!.id, id); }

  @Patch(":id/opened")
  opened(@Req() request: AuthRequest, @Param("id") id: string) { return this.notifications.markOpened(request.user!.id, id); }
}
