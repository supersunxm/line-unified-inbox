import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@prisma/client";

export const IS_PUBLIC = "isPublic";
export const REQUIRED_ROLES = "requiredRoles";
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES, roles);
