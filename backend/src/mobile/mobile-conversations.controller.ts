import { BadRequestException, Body, Controller, Get, Param, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthRequest } from "../auth/auth.guard";
import { SendConversationMessageDto } from "../dto";
import { MobileConversationQueryDto, MobileMessageQueryDto } from "./mobile-conversations.dto";
import { MobileConversationsService } from "./mobile-conversations.service";

@Controller("mobile/conversations")
export class MobileConversationsController {
  constructor(private readonly conversations: MobileConversationsService) {}

  @Get()
  list(@Req() request: AuthRequest, @Query() query: MobileConversationQueryDto) { return this.conversations.list(request.user!, query); }

  @Get(":id")
  get(@Req() request: AuthRequest, @Param("id") id: string, @Query() query: MobileMessageQueryDto) { return this.conversations.get(request.user!, id, query); }

  @Post(":id/messages")
  send(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: SendConversationMessageDto) { return this.conversations.send(request.user!, id, dto); }

  @Post(":id/images")
  @UseInterceptors(FileInterceptor("image"))
  sendImage(@Req() request: AuthRequest, @Param("id") id: string, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined, @Body("idempotencyKey") idempotencyKey: string) {
    if (!file) throw new BadRequestException("Image file is required");
    return this.conversations.sendImage(request.user!, id, file, idempotencyKey);
  }
}
