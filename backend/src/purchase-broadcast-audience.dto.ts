import {
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
