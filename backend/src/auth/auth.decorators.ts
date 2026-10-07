import { SetMetadata, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { DownloadGuard } from "./download.guard";

export const IS_PUBLIC = "isPublic";
export const REQUIRED_ROLES = "requiredRoles";
export const OPERATIONAL_READ = "operationalRead";
export type AuthCapability = "downloadData";
export const Public = () => SetMetadata(IS_PUBLIC, true);
export const Roles = (...roles: UserRole[]) => SetMetadata(REQUIRED_ROLES, roles);
/** Safe operational reads formerly limited to full HQ administrators. */
export const OperationalRead = () => SetMetadata(OPERATIONAL_READ, true);
export const RequireDownload = () => UseGuards(new DownloadGuard());
