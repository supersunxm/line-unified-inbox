import { IsDateString, IsOptional, IsUUID } from "class-validator";

/** Date-only values are interpreted in UTC as an inclusive start/exclusive end range. */
export class PurchaseAnalyticsQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsUUID("4")
  storeId?: string;
}

export type PurchaseAnalyticsFilters = {
  from: string | null;
  to: string | null;
  storeId: string | null;
};
