import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { FriendSource } from "@prisma/client";

export class GenerateFriendSourceLinksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @IsString({ each: true })
  lineOaIds!: string[];
}

export class UpdateFriendSourceLinkDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  destinationUrl?: string;
}

export class QueryFriendSourceLinksDto {
  @IsOptional()
  @IsString()
  storeId?: string;

  @IsOptional()
  @IsString()
  lineOaId?: string;

  @IsOptional()
  @IsEnum(FriendSource)
  source?: FriendSource;

  @IsOptional()
  @IsString()
  isActive?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
