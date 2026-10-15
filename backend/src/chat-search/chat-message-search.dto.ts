import { Transform } from "class-transformer";
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from "class-validator";
import { CHAT_MESSAGE_SEARCH_MAX_LIMIT, CHAT_MESSAGE_SEARCH_MAX_STORE_IDS } from "./chat-search-query";

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/u;

function toStringArray(value: unknown): unknown {
  if (value === undefined || value === null) return undefined;
  return Array.isArray(value) ? value : [value];
}

export class ChatMessageSearchQueryDto {
  /** Keyword length is enforced after trimming and normalization by the query parser. */
  @IsString()
  @MaxLength(300)
  q!: string;

  @IsString()
  @Matches(CALENDAR_DATE)
  startDate!: string;

  @IsString()
  @Matches(CALENDAR_DATE)
  endDate!: string;

  @IsOptional()
  @Transform(({ value }) => toStringArray(value))
  @IsArray()
  @ArrayMaxSize(CHAT_MESSAGE_SEARCH_MAX_STORE_IDS)
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  storeIds?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @IsOptional()
  @Transform(({ value }) => (value === undefined || value === null || value === "" ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(CHAT_MESSAGE_SEARCH_MAX_LIMIT)
  limit?: number;
}
