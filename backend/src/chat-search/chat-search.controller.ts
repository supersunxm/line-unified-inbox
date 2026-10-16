import { Controller, Get, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "../auth/auth.guard";
import { ChatMessageSearchQueryDto } from "./chat-message-search.dto";
import { ChatSearchService } from "./chat-search.service";

@Controller("chat-search")
export class ChatSearchController {
  constructor(private readonly service: ChatSearchService) {}

  @Get("messages")
  async messages(@Query() query: ChatMessageSearchQueryDto, @Req() req: AuthRequest) {
    return this.service.search(req.user, query);
  }
}
