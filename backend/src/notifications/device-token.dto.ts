import { DevicePlatform } from "@prisma/client";
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class RegisterDeviceTokenDto {
  @IsString() @MinLength(20) @MaxLength(4096) token!: string;
  @IsEnum(DevicePlatform) platform!: DevicePlatform;
  @IsOptional() @IsString() @MaxLength(100) appVersion?: string;
  @IsOptional() @IsString() @MaxLength(512) deviceId?: string;
}

export class DeviceTokenDto {
  @IsString() @MinLength(20) @MaxLength(4096) token!: string;
}
