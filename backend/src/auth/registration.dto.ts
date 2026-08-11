import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";
import { StoreMembershipRole } from "@prisma/client";

export class CreateRegistrationRequestDto {
  @IsString() @IsNotEmpty() storeId!: string;
  @IsEmail() email!: string;
  @IsString() @IsNotEmpty() name!: string;
  @IsEnum(StoreMembershipRole) role: StoreMembershipRole = StoreMembershipRole.STAFF;
  @IsString() @MinLength(12) password!: string;
}
