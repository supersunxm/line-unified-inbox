import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "../auth/auth.guard";
import { SendConversationMessageDto } from "../dto";
import { MobileConversationQueryDto } from "./mobile-conversations.dto";
import { MobileConversationsService } from "./mobile-conversations.service";

@Controller("mobile/conversations")
export class MobileConversationsController {
  constructor(private readonly conversations: MobileConversationsService) {}

  @Get()
  list(@Req() request: AuthRequest, @Query() query: MobileConversationQueryDto) { return this.conversations.list(request.user!, query); }

  @Get(":id")
  get(@Req() request: AuthRequest, @Param("id") id: string) { return this.conversations.get(request.user!, id); }

  @Post(":id/messages")
  send(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: SendConversationMessageDto) { return this.conversations.send(request.user!, id, dto); }
}
