import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { Request } from "express";
import { AuthService } from "./auth.service";
import { IS_PUBLIC, REQUIRED_ROLES } from "./auth.decorators";
import { StoreAccessService } from "./store-access.service";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  status?: string;
  mustChangePassword?: boolean;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  employeeId?: string | null;
  position?: string | null;
  memberships?: Array<{ id: string; storeId: string; role: string; store: { id: string; name: string; code: string | null } }>;
  stores?: Array<{ id: string; name: string; code: string | null }>;
  profile?: { firstName?: string | null; lastName?: string | null; employeeId?: string | null; position?: string | null; phone?: string | null };
  permissions?: { platformRole: UserRole; membershipRoles: string[]; canAccessAllStores: boolean; canReply: boolean };
};
export type AuthRequest = Request & { user?: AuthUser };

const PASSWORD_CHANGE_REQUIRED_CODE = "PASSWORD_CHANGE_REQUIRED";

function isAllowedDuringPasswordChange(request: Request) {
  const path = request.path.split("?", 1)[0];
  return (
    (request.method === "GET" && path === "/auth/me") ||
    (request.method === "POST" && path === "/auth/change-password") ||
    (request.method === "POST" && (path === "/auth/logout" || path === "/auth/mobile/logout"))
  );
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly auth: AuthService, private readonly storeAccess?: StoreAccessService) {}
  async canActivate(context: ExecutionContext) {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()])) return true;
    const request = context.switchToHttp().getRequest<AuthRequest>();
    let token = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("oppo_session="))?.slice("oppo_session=".length);
    if (!token && request.headers.authorization?.startsWith("Bearer ")) {
      token = request.headers.authorization.slice("Bearer ".length).trim();
    }
    const user = await this.auth.authenticate(token);
    if (!user) throw new UnauthorizedException("Authentication required");
    request.user = user;
    if (user.mustChangePassword && !isAllowedDuringPasswordChange(request)) {
      throw new ForbiddenException({ code: PASSWORD_CHANGE_REQUIRED_CODE, message: "Password change required" });
    }
    if (user.role === "VIEWER" && request.method !== "GET" && request.path !== "/auth/logout" && (!this.storeAccess || !(await this.storeAccess.canWriteAsStoreUser(user)))) throw new ForbiddenException("Viewer access is read-only");
    const roles = this.reflector.getAllAndOverride<UserRole[]>(REQUIRED_ROLES, [context.getHandler(), context.getClass()]);
    if (roles?.length && !roles.includes(user.role)) throw new ForbiddenException("Insufficient permissions");
    return true;
  }
}
