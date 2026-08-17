import { IsEmail, IsEnum, IsNotEmpty, IsString, Length, Matches, MinLength } from "class-validator";
import { StoreMembershipRole } from "@prisma/client";
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_PATTERN } from "./password-policy";

export class CreateRegistrationRequestDto {
  @IsString() @IsNotEmpty() storeId!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() @Length(1, 64) employeeId!: string;
  @IsEnum(StoreMembershipRole) role: StoreMembershipRole = StoreMembershipRole.STAFF;
  @IsString() @MinLength(12) @Matches(PASSWORD_POLICY_PATTERN, { message: PASSWORD_POLICY_MESSAGE }) password!: string;
}
