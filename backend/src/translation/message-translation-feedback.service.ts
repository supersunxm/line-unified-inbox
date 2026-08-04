import { BadRequestException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import {
  CreateTranslationFeedbackDto,
  TranslationFeedbackIssueCategoryInput,
} from "./dto/create-translation-feedback.dto";
import { TranslationFeedbackService, TranslationFeedbackSignal } from "./translation-feedback";

const issueCategoryToDatabase = {
  meaning_issue: "MEANING_ISSUE",
  terminology_issue: "TERMINOLOGY_ISSUE",
  other: "OTHER",
} as const;

const databaseIssueCategoryToResponse = {
  MEANING_ISSUE: "meaning_issue",
  TERMINOLOGY_ISSUE: "terminology_issue",
  OTHER: "other",
} as const;

export type MessageTranslationFeedbackResponse = {
  id: string;
  messageId: string;
  targetLanguage: "en" | "zh";
  rating: "HELPFUL" | "INCORRECT";
  issueCategory: TranslationFeedbackIssueCategoryInput | null;
  createdAt: Date;
  recorded: boolean;
};

@Injectable()
export class MessageTranslationFeedbackService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aggregates: TranslationFeedbackService,
  ) {}

  async submit(
    messageId: string,
    dto: CreateTranslationFeedbackDto,
    adminUserId: string,
  ): Promise<MessageTranslationFeedbackResponse> {
    this.validateIssueCategory(dto);
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { translatedEnglish: true, translatedChinese: true },
    });
    const translatedText = dto.targetLanguage === "en"
      ? message?.translatedEnglish
      : message?.translatedChinese;
    if (!message || !translatedText) {
      throw new UnprocessableEntityException("Translation feedback requires an existing translation");
    }

    const translationHash = createHash("sha256").update(translatedText, "utf8").digest("hex");
    const issueCategory = dto.issueCategory
      ? issueCategoryToDatabase[dto.issueCategory]
      : null;

    try {
      const created = await this.prisma.messageTranslationFeedback.create({
        data: {
          messageId,
          adminUserId,
          targetLanguage: dto.targetLanguage,
          translationHash,
          rating: dto.rating,
          issueCategory,
        },
      });
      this.aggregates.recordAfterSuccessfulTranslation("CACHED", this.toAggregateSignal(dto));
      return this.toResponse(created, true);
    } catch (error: unknown) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const existing = await this.prisma.messageTranslationFeedback.findUniqueOrThrow({
        where: {
          messageId_targetLanguage_adminUserId_translationHash: {
            messageId,
            targetLanguage: dto.targetLanguage,
            adminUserId,
            translationHash,
          },
        },
      });
      return this.toResponse(existing, false);
    }
  }

  private validateIssueCategory(dto: CreateTranslationFeedbackDto): void {
    if (dto.rating === "INCORRECT" && !dto.issueCategory) {
      throw new BadRequestException("Incorrect feedback requires an issue category");
    }
    if (dto.rating === "HELPFUL" && dto.issueCategory) {
      throw new BadRequestException("Helpful feedback cannot include an issue category");
    }
  }

  private toAggregateSignal(dto: CreateTranslationFeedbackDto): TranslationFeedbackSignal {
    if (dto.rating === "HELPFUL") return "POSITIVE";
    if (dto.issueCategory === "terminology_issue") return "TERMINOLOGY_ISSUE";
    if (dto.issueCategory === "meaning_issue") return "MEANING_ISSUE";
    return "OTHER";
  }

  private toResponse(
    feedback: {
      id: string;
      messageId: string;
      targetLanguage: string;
      rating: "HELPFUL" | "INCORRECT";
      issueCategory: "MEANING_ISSUE" | "TERMINOLOGY_ISSUE" | "OTHER" | null;
      createdAt: Date;
    },
    recorded: boolean,
  ): MessageTranslationFeedbackResponse {
    return {
      id: feedback.id,
      messageId: feedback.messageId,
      targetLanguage: feedback.targetLanguage as "en" | "zh",
      rating: feedback.rating,
      issueCategory: feedback.issueCategory
        ? databaseIssueCategoryToResponse[feedback.issueCategory]
        : null,
      createdAt: feedback.createdAt,
      recorded,
    };
  }
}
