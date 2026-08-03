import { Body, Controller, Param, Post, Req } from "@nestjs/common";
import { AuthRequest } from "../auth/auth.guard";
import { Roles } from "../auth/auth.decorators";
import { CreateMessageTranslationDto } from "./dto/create-message-translation.dto";
import { TranslationService } from "./translation.service";

@Controller("messages")
export class TranslationController {
  constructor(private readonly service: TranslationService) {}

  @Post(":messageId/translations")
  @Roles("ADMIN")
  translate(@Param("messageId") messageId: string, @Body() dto: CreateMessageTranslationDto, @Req() request: AuthRequest) {
    return this.service.translateMessage(messageId, dto.targetLanguage, request.user!.id);
  }
}
