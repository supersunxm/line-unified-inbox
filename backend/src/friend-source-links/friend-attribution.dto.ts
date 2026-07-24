import { Equals, IsBoolean, IsNotEmpty, IsOptional, IsString, Length, Matches } from "class-validator";

export class IdentifyFriendAttributionDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 128)
  @Matches(/^sat_[a-zA-Z0-9_-]+$/, { message: "sessionToken must be a valid opaque token format starting with sat_" })
  sessionToken!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(10, 4096)
  idToken?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(10, 4096)
  accessToken?: string;

  @IsBoolean()
  @Equals(true, { message: "consentGiven must be true" })
  consentGiven!: boolean;
}

export class UpdateFriendshipStatusDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 128)
  @Matches(/^sat_[a-zA-Z0-9_-]+$/, { message: "sessionToken must be a valid opaque token format starting with sat_" })
  sessionToken!: string;

  @IsBoolean()
  isFriend!: boolean;
}

export class UpsertFriendAttributionConfigDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 128)
  lineOaId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{8,20}$/, { message: "lineLoginChannelId must be numeric digits (e.g. 10 to 20 digits)" })
  lineLoginChannelId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{8,20}-[a-zA-Z0-9_-]+$/, { message: "liffId must be a valid LIFF ID format (e.g. 1234567890-AbCdEfGh)" })
  liffId!: string;

  @IsBoolean()
  isEnabled!: boolean;
}
