import { IsEmail, IsEnum, IsNotEmpty, IsString, Length, MinLength } from "class-validator";
import { StoreMembershipRole } from "@prisma/client";

export class CreateRegistrationRequestDto {
  @IsString() @IsNotEmpty() storeId!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsString() @IsNotEmpty() @Length(1, 64) employeeId!: string;
  @IsEnum(StoreMembershipRole) role: StoreMembershipRole = StoreMembershipRole.STAFF;
  @IsString() @MinLength(12) password!: string;
}
