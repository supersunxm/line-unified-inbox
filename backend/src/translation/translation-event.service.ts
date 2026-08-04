import { Injectable, Logger } from "@nestjs/common";
import { TranslationEventStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { TranslationTargetLanguage } from "./dto/create-message-translation.dto";

export type TranslationEventInput = {
  messageId: string;
  adminId: string;
  targetLanguage: TranslationTargetLanguage;
  provider: string;
  status: TranslationEventStatus;
  durationMs: number;
  characterCount: number;
  errorCategory?: string;
};

@Injectable()
export class TranslationEventService {
  private readonly logger = new Logger(TranslationEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(input: TranslationEventInput): Promise<void> {
    try {
      await this.prisma.translationEvent.create({
        data: {
          messageId: input.messageId,
          adminId: input.adminId,
          targetLanguage: input.targetLanguage,
          provider: input.provider,
          status: input.status,
          durationMs: input.durationMs,
          characterCount: input.characterCount,
          ...(input.errorCategory ? { errorCategory: input.errorCategory } : {}),
        },
        select: { id: true },
      });
    } catch {
      this.logger.error({ event: "translation_event_persistence_failed", status: input.status });
    }
  }
}
