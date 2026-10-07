import { UserRole } from "@prisma/client";
import { IsIn } from "class-validator";

export const HQ_ACCOUNT_ROLES = [UserRole.ADMIN, UserRole.ASSISTANT] as const;
export type HqAccountRole = (typeof HQ_ACCOUNT_ROLES)[number];

export class ChangeHqRoleDto {
  @IsIn(HQ_ACCOUNT_ROLES)
  role!: HqAccountRole;
}
