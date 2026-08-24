import { IsNotEmpty, IsString, Length, MinLength } from "class-validator";

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
