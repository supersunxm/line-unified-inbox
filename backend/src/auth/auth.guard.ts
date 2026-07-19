import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { IS_PUBLIC, REQUIRED_ROLES } from "./auth.decorators";

export type AuthUser = { id: string; email: string; displayName: string; role: UserRole; isActive: boolean };
export type AuthRequest = Request & { user?: AuthUser };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("oppo_session="))?.slice("oppo_session=".length);
    const user = await this.auth.authenticate(token);
    if (!user) throw new UnauthorizedException("Authentication required");
    request.user = user;
    if (user.role === "VIEWER" && request.method !== "GET" && request.path !== "/auth/logout") throw new ForbiddenException("Viewer access is read-only");
    const roles = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES, [context.getHandler(), context.getClass()]);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException("Insufficient permissions");
    return true;
  }
}
