import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import type { AuthRequest } from "./auth.guard";
import { hasCapability } from "./capability-policy";

@Injectable()
export class DownloadGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>();
    if (!request.user || !hasCapability(request.user.role, "downloadData")) {
      throw new ForbiddenException("Download permission is required");
    }
    return true;
  }
}
