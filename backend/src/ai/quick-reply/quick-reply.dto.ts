import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min, ValidateIf } from "class-validator";
import type { QuickReplyLocale } from "./quick-reply.types";

export class GenerateQuickRepliesDto {
  @IsOptional()
  @IsIn(["th", "en", "zh"])
  locale: QuickReplyLocale = "th";

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  maxSuggestions = 3;
}

export interface QuickReplySuggestionDto {
  id: string;
  text: string;
  intent: string;
  source: string;
  confidence: number;
  grounded: boolean;
  riskFlags: string[];
  requiresHumanApproval: true;
}

export interface QuickReplyGenerationResponseDto {
  generationId: string;
  conversationId: string;
  contextMessageId: string;
  contextVersion: string;
  generatedAt: string;
  expiresAt: string;
  fallbackUsed: boolean;
  suggestions: QuickReplySuggestionDto[];
}

export class QuickReplyLifecycleEventDto {
  @IsUUID()
  generationId!: string;

  @IsIn(["SHOWN", "SELECTED", "EDITED", "DISMISSED"])
  event!: "SHOWN" | "SELECTED" | "EDITED" | "DISMISSED";

  @ValidateIf((dto: QuickReplyLifecycleEventDto) => dto.event !== "SHOWN")
  @IsUUID()
  suggestionId?: string;

  @IsString()
  @Length(32, 64)
  contextVersion!: string;
}
