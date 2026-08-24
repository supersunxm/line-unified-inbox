import { SessionType } from "@prisma/client";
import type { PermissionContext } from "./permission-context";

export function platformAllowed(context: PermissionContext, sessionType: SessionType) {
  return sessionType === SessionType.WEB ? context.platforms.web : context.platforms.mobile;
}
