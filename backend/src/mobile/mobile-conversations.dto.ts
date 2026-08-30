import { BmReplyStatus, ConversationSourceChannel, CustomerInterestLevel, CustomerSalesStatus, PaymentMethodType, ProductGroup } from "@prisma/client";
import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class MobileConversationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) pageSize = 30;
  @IsOptional() @IsUUID("4") storeId?: string;
  @IsOptional() @IsEnum(BmReplyStatus) bmReplyStatus?: BmReplyStatus;
  @IsOptional() @IsIn(["NEED_REPLY"]) replyStatusGroup?: "NEED_REPLY";
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}

export class MobileMessageQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 50;
  @IsOptional() @IsString() before?: string;
}

export class UpdateMobileBmReplyStatusDto {
  @IsEnum(BmReplyStatus)
  status!: BmReplyStatus;
}

export class UpdateMobileConversationOwnerDto {
  @IsOptional()
  @IsUUID("4")
  userId?: string | null;
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

export class UpdateMobilePurchaseInformationDto {
  @IsOptional() @ArrayMaxSize(2) @IsEnum(ConversationSourceChannel, { each: true }) purchaseChannel?: ConversationSourceChannel[];
  @IsOptional() @IsIn(["INSTALLMENT"]) paymentMethod?: "INSTALLMENT" | null;
  @IsOptional() @IsUUID("4") productModelId?: string | null;
  @IsOptional() @IsUUID("4") productVariantId?: string | null;
}

export class SalesProductItemDto {
  @IsOptional() @IsUUID("4") id?: string;
  @IsUUID("4") productModelId!: string;
  @IsOptional() @IsUUID("4") productVariantId?: string | null;
  @IsOptional() @IsString() @MaxLength(200) customProductName?: string | null;
  @IsOptional() @IsString() @MaxLength(50) ram?: string | null;
  @IsOptional() @IsString() @MaxLength(50) rom?: string | null;
  @IsOptional() @IsString() @MaxLength(50) color?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(999) quantity = 1;
  @IsOptional() @IsEnum(CustomerSalesStatus) status?: CustomerSalesStatus;
}

export class UpdateCustomerSalesInformationDto {
  @IsOptional() @IsEnum(CustomerSalesStatus) status?: CustomerSalesStatus | null;
  @IsOptional() @IsEnum(CustomerInterestLevel) interestLevel?: CustomerInterestLevel | null;
  @IsOptional() @ArrayMaxSize(2) @IsEnum(ConversationSourceChannel, { each: true }) purchaseChannel?: ConversationSourceChannel[];
  @IsOptional() @IsEnum(PaymentMethodType) paymentMethod?: PaymentMethodType | null;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => SalesProductItemDto) products?: SalesProductItemDto[];
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
