import { Controller, ForbiddenException, Get, Param, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "./auth/auth.guard";
import { HistoricalTimelineService } from "./historical-timeline.service";

@Controller("historical-timeline")
export class HistoricalTimelineController {
  constructor(private readonly timeline: HistoricalTimelineService) {}

  @Get("analytics/replies")
  async replyAnalytics(
    @Req() request: AuthRequest,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("storeId") storeId?: string,
  ) {
    if (!request.user) throw new ForbiddenException("Authentication required");
    return this.timeline.replyAnalytics(request.user, { dateFrom, dateTo, storeId });
  }

  @Get("chats")
  async chats(
    @Req() request: AuthRequest,
    @Query("storeId") storeId?: string,
    @Query("search") search?: string,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "30",
  ) {
    if (!request.user) throw new ForbiddenException("Authentication required");
    return this.timeline.listVirtualChats(request.user, {
      storeId,
      search,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get("chats/:id/messages")
  async messages(
    @Param("id") id: string,
    @Req() request: AuthRequest,
    @Query("page") page = "1",
    @Query("pageSize") pageSize = "30",
  ) {
    if (!request.user) throw new ForbiddenException("Authentication required");
    return this.timeline.virtualMessages(request.user, id, Number(page), Number(pageSize));
  }

  @Get("chats/:id")
  async chat(@Param("id") id: string, @Req() request: AuthRequest) {
    if (!request.user) throw new ForbiddenException("Authentication required");
    return this.timeline.getVirtualChat(request.user, id);
  }
}
