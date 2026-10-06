import { BmReplyStatus, FollowUpStatus, Priority } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsArray, IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";

export class ConversationQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsEnum(FollowUpStatus) followUpStatus?: FollowUpStatus;
  @IsOptional() @IsEnum(BmReplyStatus) bmReplyStatus?: BmReplyStatus;
  @IsOptional() @IsIn(["REPLIED", "NOT_REPLIED"]) replyState?: "REPLIED" | "NOT_REPLIED";
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsString() productSeriesId?: string;
  @IsOptional() @IsString() productModelId?: string;
  @IsOptional() @IsString() topicId?: string;
  @IsOptional() @IsString() lineOaId?: string;
  @IsOptional() @Matches(/^(all|\d{4}-(0[1-9]|1[0-2]))$/) month?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsIn(["latest-desc", "latest-asc", "priority-desc"]) sort = "latest-desc";
}

export class ConversationSummaryQueryDto {
  @IsOptional() @Matches(/^(all|\d{4}-(0[1-9]|1[0-2]))$/) month?: string;
}

export class UpdateStatusDto {
  @IsOptional() @IsEnum(FollowUpStatus) status?: FollowUpStatus;
  @IsOptional() @IsEnum(BmReplyStatus) bmReplyStatus?: BmReplyStatus;
}
export class UpdateBmReplyStatusDto {
  @IsOptional() @IsEnum(BmReplyStatus) status?: BmReplyStatus;
  @IsOptional() @IsEnum(BmReplyStatus) bmReplyStatus?: BmReplyStatus;
}
export class BulkUpdateBmReplyStatusDto {
  @IsString() @IsNotEmpty() storeId!: string;
  @IsEnum(BmReplyStatus) status!: BmReplyStatus;
  @IsOptional() @IsArray() @IsEnum(BmReplyStatus, { each: true }) fromStatuses?: BmReplyStatus[];
}
export class BulkMarkRepliedDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  conversationIds!: string[];
}
export class BulkMarkRepliedByFilterDto {
  @IsOptional()
  @IsEnum(BmReplyStatus)
  bmReplyStatus?: BmReplyStatus;

  @IsOptional()
  @IsString()
  storeId?: string;
}
export class UpdatePriorityDto { @IsEnum(Priority) priority!: Priority; }
export class CreateNoteDto {
  @IsString() @IsNotEmpty() content!: string;
  @IsOptional() @IsString() createdByName?: string;
}

export class SendConversationMessageDto {
  @IsString() @IsNotEmpty() @MaxLength(5000) text!: string;
  @IsUUID("4") idempotencyKey!: string;
}
