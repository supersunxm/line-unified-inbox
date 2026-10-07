import { UserRole } from "@prisma/client";
import type { AuthCapability } from "./auth.decorators";

export function hasCapability(role: UserRole, capability: AuthCapability) {
  if (capability === "downloadData") return role === UserRole.ADMIN;
  return false;
}
