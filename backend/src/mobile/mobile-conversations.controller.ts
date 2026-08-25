import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthRequest } from "../auth/auth.guard";
import { SendConversationMessageDto } from "../dto";
import { MobileConversationQueryDto, MobileMessageQueryDto, UpdateCustomerSalesInformationDto, UpdateMobileBmReplyStatusDto, UpdateMobileConversationTagsDto, UpdateMobilePurchaseInformationDto } from "./mobile-conversations.dto";
import { MobileConversationsService } from "./mobile-conversations.service";

@Controller("mobile/conversations")
export class MobileConversationsController {
  constructor(private readonly conversations: MobileConversationsService) {}

  @Get()
  list(@Req() request: AuthRequest, @Query() query: MobileConversationQueryDto) { return this.conversations.list(request.user!, query); }

  @Get(":id")
  get(@Req() request: AuthRequest, @Param("id") id: string, @Query() query: MobileMessageQueryDto) { return this.conversations.get(request.user!, id, query); }

  @Patch(":id/read")
  markRead(@Req() request: AuthRequest, @Param("id") id: string) { return this.conversations.markRead(request.user!, id); }

  @Patch(":id/bm-reply-status")
  updateBmReplyStatus(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateMobileBmReplyStatusDto) { return this.conversations.updateBmReplyStatus(request.user!, id, dto.status); }

  @Patch(":id/tags")
  updateTags(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateMobileConversationTagsDto) { return this.conversations.updateTags(request.user!, id, dto); }

  @Patch(":id/purchase-information")
  updatePurchaseInformation(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateMobilePurchaseInformationDto) { return this.conversations.updatePurchaseInformation(request.user!, id, dto); }

  @Patch(":id/customer-sales-info")
  updateCustomerSalesInfo(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: UpdateCustomerSalesInformationDto) { return this.conversations.updateCustomerSalesInfo(request.user!, id, dto); }

  @Post(":id/messages")
  send(@Req() request: AuthRequest, @Param("id") id: string, @Body() dto: SendConversationMessageDto) { return this.conversations.send(request.user!, id, dto); }

  @Post(":id/images")
  @UseInterceptors(FileInterceptor("image"))
  sendImage(@Req() request: AuthRequest, @Param("id") id: string, @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number } | undefined, @Body("idempotencyKey") idempotencyKey: string) {
    if (!file) throw new BadRequestException("Image file is required");
    return this.conversations.sendImage(request.user!, id, file, idempotencyKey);
  }
}
