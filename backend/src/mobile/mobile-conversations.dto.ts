import { ConversationSourceChannel, ProductGroup } from "@prisma/client";
import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class MobileConversationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 30;
}

export class MobileMessageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @IsString() before?: string;
}

export class MobileProductQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsEnum(ProductGroup) category?: ProductGroup;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 30;
}

export class UpdateMobileConversationTagsDto {
  @IsOptional() @IsEnum(ConversationSourceChannel) sourceChannel?: ConversationSourceChannel | null;
  @IsOptional() @IsUUID("4") productId?: string | null;
}
