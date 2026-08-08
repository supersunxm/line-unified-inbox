import { BmReplyStatus, FollowUpStatus, Priority } from "@prisma/client";
import { Transform } from "class-transformer";
import { IsEnum, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class ConversationQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsEnum(FollowUpStatus) followUpStatus?: FollowUpStatus;
  @IsOptional() @IsEnum(BmReplyStatus) bmReplyStatus?: BmReplyStatus;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsString() productSeriesId?: string;
  @IsOptional() @IsString() productModelId?: string;
  @IsOptional() @IsString() topicId?: string;
  @IsOptional() @IsString() lineOaId?: string;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) page = 1;
  @IsOptional() @Transform(({ value }) => Number(value)) @IsInt() @Min(1) @Max(100) pageSize = 25;
  @IsOptional() @IsIn(["latest-desc", "latest-asc", "priority-desc"]) sort = "latest-desc";
}

export class UpdateStatusDto {
  @IsOptional() @IsEnum(FollowUpStatus) status?: FollowUpStatus;
  @IsOptional() @IsEnum(BmReplyStatus) bmReplyStatus?: BmReplyStatus;
}
export class UpdateBmReplyStatusDto {
  @IsOptional() @IsEnum(BmReplyStatus) status?: BmReplyStatus;
  @IsOptional() @IsEnum(BmReplyStatus) bmReplyStatus?: BmReplyStatus;
}
export class UpdatePriorityDto { @IsEnum(Priority) priority!: Priority; }
export class CreateNoteDto {
  @IsString() @IsNotEmpty() content!: string;
  @IsOptional() @IsString() createdByName?: string;
}
