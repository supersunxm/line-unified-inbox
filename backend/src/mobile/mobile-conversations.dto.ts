import { ConversationSourceChannel, ProductGroup } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from "class-validator";

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
  @IsOptional() @ArrayMaxSize(2) @IsEnum(ConversationSourceChannel, { each: true }) sourceChannels?: ConversationSourceChannel[];
  @IsOptional() @IsBoolean() isInstallment?: boolean;
  @IsOptional() @IsUUID("4") productId?: string | null;
  @IsOptional() @IsUUID("4") variantId?: string | null;
}

export class MobileProductVariantQueryDto {
  @IsOptional() @IsInt() @Min(1) @Max(50) @Type(() => Number) limit = 50;
}

export class MonthlySummaryQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  month?: string;
}
