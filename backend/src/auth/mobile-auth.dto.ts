import { IsNotEmpty, IsOptional, IsString, Length, Matches, MinLength } from "class-validator";

export const PIN_PATTERN = /^\d{6}$/;
export const PIN_POLICY_MESSAGE = "PIN must be exactly 6 digits";

export class MobilePasswordLoginDto {
  @IsString() @IsNotEmpty() email!: string;
  @IsString() @MinLength(1) password!: string;
}

export class MobileSendOtpDto {
  @IsString() phone!: string;
}

export class MobileVerifyOtpDto {
  @IsString() challengeId!: string;
  @IsString() @Length(6, 6) otp!: string;
}

export class MobilePinLoginDto {
  @IsString() @IsNotEmpty() employeeId!: string;
  @IsString() @Matches(PIN_PATTERN, { message: PIN_POLICY_MESSAGE }) pin!: string;
}

export class MobilePinSetupDto {
  @IsString() @Matches(PIN_PATTERN, { message: PIN_POLICY_MESSAGE }) pin!: string;
  @IsString() @Matches(PIN_PATTERN, { message: PIN_POLICY_MESSAGE }) confirmationPin!: string;
}

export class MobilePinChangeDto {
  @IsOptional() @IsString() @Matches(PIN_PATTERN, { message: PIN_POLICY_MESSAGE }) currentPin?: string;
  @IsOptional() @IsString() @MinLength(1) currentPassword?: string;
  @IsString() @Matches(PIN_PATTERN, { message: PIN_POLICY_MESSAGE }) pin!: string;
  @IsString() @Matches(PIN_PATTERN, { message: PIN_POLICY_MESSAGE }) confirmationPin!: string;
}

export class MobilePinResetDto {
  @IsString() @IsNotEmpty() currentPassword!: string;
  @IsString() @Matches(PIN_PATTERN, { message: PIN_POLICY_MESSAGE }) pin!: string;
  @IsString() @Matches(PIN_PATTERN, { message: PIN_POLICY_MESSAGE }) confirmationPin!: string;
}

export class MobilePinDisableDto {
  @IsString() @IsNotEmpty() password!: string;
}
