import { IsString, Length } from "class-validator";

export class MobileSendOtpDto {
  @IsString() phone!: string;
}

export class MobileVerifyOtpDto {
  @IsString() challengeId!: string;
  @IsString() @Length(6, 6) otp!: string;
}
