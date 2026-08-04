import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { AuthRequest } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { CreateMessageTranslationDto } from "./dto/create-message-translation.dto";
import { CreateTranslationFeedbackDto } from "./dto/create-translation-feedback.dto";
import { MessageTranslationFeedbackService } from "./message-translation-feedback.service";
import { TranslationService } from "./translation.service";

@Controller("messages")
export class TranslationController {
  constructor(
    private readonly service: TranslationService,
    private readonly feedback: MessageTranslationFeedbackService,
  ) {}

  @Post(":messageId/translations")
  @Roles("ADMIN")
  translate(@Param("messageId") messageId: string, @Body() dto: CreateMessageTranslationDto, @Req() request: AuthRequest) {
    return this.service.translateMessage(messageId, dto.targetLanguage, request.user!.id);
  }

  @Post(":messageId/translations/feedback")
  @Roles("ADMIN")
  submitFeedback(@Param("messageId") messageId: string, @Body() dto: CreateTranslationFeedbackDto, @Req() request: AuthRequest) {
    return this.feedback.submit(messageId, dto, request.user!.id);
  }
}
