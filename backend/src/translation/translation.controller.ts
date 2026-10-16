import { Body, Controller, NotFoundException, Param, Post, Req } from "@nestjs/common";
import { AuthRequest } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { PrismaService } from "../prisma.service";
import { AllowScopedNonReplyAction, Roles } from "../auth/auth.decorators";
import { CreateMessageTranslationDto } from "./dto/create-message-translation.dto";
import { CreateTranslationFeedbackDto } from "./dto/create-translation-feedback.dto";
import { MessageTranslationFeedbackService } from "./message-translation-feedback.service";
import { TranslationService } from "./translation.service";

@Controller("messages")
export class TranslationController {
  constructor(
    private readonly service: TranslationService,
    private readonly feedback: MessageTranslationFeedbackService,
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  @Post(":messageId/translations")
  @Roles("ADMIN", "ASSISTANT", "VIEWER")
  @AllowScopedNonReplyAction()
  async translate(@Param("messageId") messageId: string, @Body() dto: CreateMessageTranslationDto, @Req() request: AuthRequest) {
    await this.assertMessageAccess(messageId, request);
    return this.service.translateMessage(messageId, dto.targetLanguage, request.user!.id);
  }

  @Post(":messageId/translations/feedback")
  @Roles("ADMIN", "ASSISTANT", "VIEWER")
  @AllowScopedNonReplyAction()
  async submitFeedback(@Param("messageId") messageId: string, @Body() dto: CreateTranslationFeedbackDto, @Req() request: AuthRequest) {
    await this.assertMessageAccess(messageId, request);
    return this.feedback.submit(messageId, dto, request.user!.id);
  }

  private async assertMessageAccess(messageId: string, request: AuthRequest): Promise<void> {
    const message = await this.prisma.message.findUnique({ where: { id: messageId }, select: { conversationId: true } });
    if (!message) throw new NotFoundException("Message not found");
    await this.storeAccess.assertConversationAccess(request.user!, message.conversationId);
  }
}
