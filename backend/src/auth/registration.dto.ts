import { IsEmail, IsEnum, IsNotEmpty, IsString, Length } from "class-validator";
import { StoreMembershipRole } from "@prisma/client";

export class CreateRegistrationRequestDto {
  @IsString() @IsNotEmpty() storeId!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() phone!: string;
  @IsString() @IsNotEmpty() firstName!: string;
  @IsString() @IsNotEmpty() lastName!: string;
  @IsString() @IsNotEmpty() employeeId!: string;
  @IsString() @IsNotEmpty() position!: string;
  @IsEnum(StoreMembershipRole) requestedRole: StoreMembershipRole = StoreMembershipRole.STAFF;
}

export class VerifyRegistrationOtpDto {
  @IsString() @Length(6, 6) otp!: string;
}
