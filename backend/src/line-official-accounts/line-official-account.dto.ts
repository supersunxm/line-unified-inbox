import { Type } from "class-transformer";
import { IsBoolean, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";

export class CreateStoreDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() code?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() area?: string;
}

export class CreateLineOfficialAccountDto {
  @IsOptional() @IsString() storeId?: string;
  @IsOptional() @IsString() storeMasterId?: string;
  @IsOptional() @ValidateNested() @Type(() => CreateStoreDto) newStore?: CreateStoreDto;
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() basicId?: string;
  @IsOptional() @IsString() channelId?: string;
  @IsOptional() @IsString() destinationId?: string;
  @IsString() @IsNotEmpty() channelSecret!: string;
  @IsString() @IsNotEmpty() channelAccessToken!: string;
  @IsOptional() @IsBoolean() isActive = true;
}

export class UpdateLineOfficialAccountDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() basicId?: string;
  @IsOptional() @IsString() channelId?: string;
  @IsOptional() @IsString() destinationId?: string;
  @IsOptional() @IsString() channelSecret?: string;
  @IsOptional() @IsString() channelAccessToken?: string;
  @IsOptional() @IsString() storeId?: string;
}

export class UpdateLineOaStatusDto { @IsBoolean() isActive!: boolean; }
