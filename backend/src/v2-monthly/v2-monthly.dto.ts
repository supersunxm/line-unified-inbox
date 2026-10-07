import { IsOptional, IsString, MaxLength, ValidateIf } from "class-validator";

export class SetStorePartnerDto {
  /** null or "" clears the partner ("ไม่ระบุ partner"). */
  @ValidateIf((_, value) => value !== null)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  partner?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class CloseMonthDto {
  /** Required to re-close a month that is already closed. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class RederiveTagsDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
