import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthRequest } from "../auth/auth.guard";
import { SendConversationMessageDto } from "../dto";
import { PrismaService } from "../prisma.service";
import { MobileConversationQueryDto, MobileMessageQueryDto, UpdateCustomerSalesInformationDto, UpdateMobileBmReplyStatusDto, UpdateMobileConversationTagsDto, UpdateMobilePurchaseInformationDto } from "./mobile-conversations.dto";
import { MobileConversationsService } from "./mobile-conversations.service";

const AUTO_REPLY_BOT_DISPLAY_NAME = "Auto Reply Bot";

@Controller("mobile/conversations")
export class MobileConversationsController {
  constructor(
    private readonly conversations: MobileConversationsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@Req() request: AuthRequest, @Query() query: MobileConversationQueryDto) {
    const result = await this.conversations.list(request.user!, query);
    const lastMessageIds = result.items
      .map((item) => item.lastMessage?.id)
      .filter((id): id is string => Boolean(id));

    if (!lastMessageIds.length) return result;

    const botMessages = await this.prisma.message.findMany({
      where: {
        id: { in: lastMessageIds },
        senderDisplayName: AUTO_REPLY_BOT_DISPLAY_NAME,
      },
      select: { id: true },
    });
    const botMessageIds = new Set(botMessages.map((message) => message.id));

    return {
      ...result,
      items: result.items.map((item) => {
        const lastMessage = item.lastMessage;
        if (!lastMessage || !botMessageIds.has(lastMessage.id)) return item;
        return {
          ...item,
          lastMessage: {
            ...lastMessage,
            // Existing mobile releases prefix every OUTBOUND preview with
            // "You:". Bot replies are still stored canonically as OUTBOUND;
            // this mobile-list presentation override prevents staff from
            // mistaking an automated reply for a human reply without changing
            // the underlying message direction or chat history.
            direction: "SYSTEM" as const,
            preview: `Bot: ${lastMessage.preview}`,
          },
        };
      }),
    };
  }

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
