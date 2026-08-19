import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";
import { PurchaseAnalyticsQueryDto } from "./purchase-analytics.dto";

export enum PurchaseAudienceStatus {
  PURCHASED = "PURCHASED",
  INTERESTED = "INTERESTED",
  NOT_SPECIFIED = "NOT_SPECIFIED",
}

export class CreatePurchaseBroadcastDraftDto extends PurchaseAnalyticsQueryDto {
  @IsUUID("4")
  campaignRequestId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(PurchaseAudienceStatus, { each: true })
  statuses!: PurchaseAudienceStatus[];

  @IsBoolean()
  onlyMessageable!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;
}

export class UpdatePurchaseBroadcastDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsArray()
  @ArrayMaxSize(2)
  messages!: Array<Record<string, unknown>>;
}
