import { ForbiddenException, Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { MembershipStatus, Prisma, SessionType, UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { PasswordService } from "./password.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuditLogService } from "./audit-log.service";
import { assertPasswordPolicy } from "./password-policy";
import { buildPermissionContext, hasWorkspaceAccess } from "./permission-context";

type AuthUserSource = {
  id: string;
  email: string;
  displayName: string;
  role: "ADMIN" | "VIEWER";
  isActive: boolean;
  canAccessWeb?: boolean;
  canAccessMobile?: boolean;
  canAccessHq?: boolean;
  canAccessAllStores?: boolean;
  canManageAccounts?: boolean;
  canReply?: boolean;
  canAccessMainOa?: boolean;
  canManageMainOa?: boolean;
  status?: string;
  mustChangePassword?: boolean;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  employeeId?: string | null;
  position?: string | null;
  memberships?: Array<{ id: string; storeId: string; role: string; store: { id: string; name: string; code: string | null } }>;
};

@Injectable()
export class AuthService {
  static readonly ACCESS_SESSION_MS = 12 * 60 * 60 * 1000;
  static readonly MOBILE_REFRESH_SESSION_MS = 30 * 24 * 60 * 60 * 1000;
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService, private readonly rateLimiter?: AuthRateLimitService, private readonly audit?: AuditLogService) {}

  private tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }

  private authorizationFor(user: AuthUserSource) {
    return buildPermissionContext({
      role: user.role,
      canAccessWeb: user.canAccessWeb,
      canAccessMobile: user.canAccessMobile,
      canAccessHq: user.canAccessHq,
      canAccessAllStores: user.canAccessAllStores,
      canManageAccounts: user.canManageAccounts,
      canReply: user.canReply,
      canAccessMainOa: user.canAccessMainOa,
      canManageMainOa: user.canManageMainOa,
      memberships: user.memberships,
    });
  }

  private safeUser(user: AuthUserSource) {
    const memberships = user.memberships?.map((membership) => ({ id: membership.id, storeId: membership.storeId, role: membership.role, store: membership.store })) ?? [];
    const authorization = this.authorizationFor({ ...user, memberships });
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      status: user.status,
      mustChangePassword: user.mustChangePassword ?? false,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeId: user.employeeId,
      position: user.position,
      memberships,
      stores: memberships.map((membership) => membership.store),
      profile: { firstName: user.firstName, lastName: user.lastName, employeeId: user.employeeId, position: user.position, phone: user.phone },
      authorization,
      permissions: {
        platformRole: authorization.identity.platformRole,
        membershipRoles: authorization.identity.membershipRoles,
        canAccessAllStores: authorization.scope.allStores,
        canReply: authorization.capabilities.reply,
        canAccessMainOa: authorization.capabilities.accessMainOa,
        canManageMainOa: authorization.capabilities.manageMainOa,
        canManageAccounts: authorization.capabilities.manageAccounts,
        version: authorization.version,
        platforms: authorization.platforms,
        workspaces: authorization.workspaces,
        scope: authorization.scope,
        capabilities: authorization.capabilities,
      },
    };
  }

  private userInclude = { memberships: { where: { status: "ACTIVE", store: { isActive: true, archivedAt: null } }, select: { id: true, storeId: true, role: true, store: { select: { id: true, name: true, code: true } } } } } as const;

  private platformAccessAllowed(user: AuthUserSource, sessionType: SessionType) {
    const authorization = this.authorizationFor(user);
    return sessionType === SessionType.WEB ? authorization.platforms.web : authorization.platforms.mobile;
  }

  private async rejectPlatformAccess(user: AuthUserSource, sessionType: SessionType, ip: string, userAgent?: string): Promise<never> {
    const code = sessionType === SessionType.WEB ? "WEB_ACCESS_NOT_GRANTED" : "MOBILE_ACCESS_NOT_GRANTED";
    await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_REJECTED", metadata: { reason: code }, ipAddress: ip, userAgent });
    throw new ForbiddenException({ code, message: sessionType === SessionType.WEB ? "Web access is not granted for this account" : "Mobile access is not granted for this account" });
  }

  async login(email: string, password: string, sessionType: SessionType = SessionType.WEB, ip = "unknown", userAgent?: string) {
    const identifier = email.trim().toLowerCase();
    await this.rateLimiter?.assertLoginAllowed(ip, identifier);
    const user = await this.prisma.user.findFirst({ where: { OR: [{ normalizedEmail: identifier }, { username: identifier }] }, include: this.userInclude });
    if (!user || !user.passwordHash || !(await this.passwords.verify(password, user.passwordHash))) {
      await this.rateLimiter?.recordLoginFailure(ip, identifier);
      await this.audit?.record({ action: "USER_LOGIN_FAILED", targetUserId: user?.id, ipAddress: ip, userAgent });
      this.logger.warn(JSON.stringify({ event: "login_failure", reason: "invalid_credentials" }));
      throw new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
    }
    if (!user.isActive || user.status === UserStatus.SUSPENDED) {
      await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_REJECTED", metadata: { reason: user.status === UserStatus.SUSPENDED ? "SUSPENDED" : "INACTIVE" }, ipAddress: ip, userAgent });
      throw new UnauthorizedException({ code: "ACCOUNT_SUSPENDED", message: "Account is suspended" });
    }
    if (user.status === UserStatus.PENDING_APPROVAL) {
      await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_REJECTED", metadata: { reason: "PENDING_APPROVAL" }, ipAddress: ip, userAgent });
      throw new UnauthorizedException({ code: "ACCOUNT_PENDING_APPROVAL", message: "Account is pending approval" });
    }
    if (user.status === UserStatus.REJECTED) {
      await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_REJECTED", metadata: { reason: "REJECTED" }, ipAddress: ip, userAgent });
      throw new UnauthorizedException({ code: "ACCOUNT_REJECTED", message: "Account has been rejected" });
    }
    const authorization = this.authorizationFor(user);
    if (!hasWorkspaceAccess(authorization)) {
      await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_REJECTED", metadata: { reason: "NO_WORKSPACE_ACCESS" }, ipAddress: ip, userAgent });
      throw new ForbiddenException({ code: "WORKSPACE_ACCESS_NOT_GRANTED", message: "No workspace access is granted for this account" });
    }
    if (!this.platformAccessAllowed(user, sessionType)) await this.rejectPlatformAccess(user, sessionType, ip, userAgent);

    const session = await this.createSession(user.id, sessionType);
    this.logger.log(JSON.stringify({ event: "login_success", userId: user.id, role: user.role, sessionType }));
    await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_SUCCESS", metadata: { sessionType }, ipAddress: ip, userAgent });
    return { ...session, user: this.safeUser(user) };
  }

  async authenticate(token?: string, expectedSessionType?: SessionType) {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: this.tokenHash(token) }, include: { user: { include: this.userInclude } } });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive || session.user.status !== UserStatus.ACTIVE) return null;
    if (expectedSessionType && session.sessionType !== expectedSessionType) return null;
    const authorization = this.authorizationFor(session.user);
    if (!hasWorkspaceAccess(authorization)) return null;
    if (session.sessionType === SessionType.WEB && !authorization.platforms.web) return null;
    if (session.sessionType === SessionType.MOBILE && !authorization.platforms.mobile) return null;
    return this.safeUser(session.user);
  }

  async logout(token?: string, ip?: string, userAgent?: string) {
    if (token) {
      const session = await this.prisma.session.findUnique({ where: { tokenHash: this.tokenHash(token) }, select: { userId: true } });
      await this.prisma.session.deleteMany({ where: { tokenHash: this.tokenHash(token) } });
      if (session) await this.audit?.record({ actorUserId: session.userId, action: "USER_LOGOUT", ipAddress: ip, userAgent });
    }
  }

  async createSession(userId: string, sessionType: SessionType, client: Prisma.TransactionClient | PrismaService = this.prisma) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + AuthService.ACCESS_SESSION_MS);
    const refreshToken = sessionType === SessionType.MOBILE ? randomBytes(48).toString("base64url") : undefined;
    const refreshExpiresAt = refreshToken ? new Date(Date.now() + AuthService.MOBILE_REFRESH_SESSION_MS) : undefined;
    const writes = [client.session.create({ data: { tokenHash: this.tokenHash(token), refreshTokenHash: refreshToken ? this.tokenHash(refreshToken) : null, userId, sessionType, expiresAt, refreshExpiresAt } }), client.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })];
    if (client === this.prisma) await this.prisma.$transaction(writes);
    else await Promise.all(writes);
    return { token, expiresAt, refreshToken, refreshExpiresAt };
  }

  async refreshMobileSession(refreshToken: string) {
    const oldHash = this.tokenHash(refreshToken);
    const now = new Date();
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: oldHash }, include: { user: { include: this.userInclude } } });
    const valid = session?.sessionType === SessionType.MOBILE && session.refreshExpiresAt && session.refreshExpiresAt > now && session.user.isActive && session.user.status === UserStatus.ACTIVE && hasWorkspaceAccess(this.authorizationFor(session.user)) && this.authorizationFor(session.user).platforms.mobile;
    if (!valid) throw new UnauthorizedException({ code: "SESSION_EXPIRED", message: "Session expired" });
    const token = randomBytes(32).toString("base64url");
    const nextRefreshToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date(now.getTime() + AuthService.ACCESS_SESSION_MS);
    const updated = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: oldHash, refreshExpiresAt: { gt: now } },
      data: { tokenHash: this.tokenHash(token), refreshTokenHash: this.tokenHash(nextRefreshToken), expiresAt },
    });
    if (updated.count !== 1) throw new UnauthorizedException({ code: "SESSION_EXPIRED", message: "Session expired" });
    this.logger.log(JSON.stringify({ event: "mobile_session_refreshed", userId: session.userId }));
    return { accessToken: token, expiresAt, refreshToken: nextRefreshToken, refreshExpiresAt: session.refreshExpiresAt };
  }

  async logoutMobile(token?: string, refreshToken?: string) {
    if (!token && !refreshToken) return;
    const tokenHash = token ? this.tokenHash(token) : undefined;
    const refreshTokenHash = refreshToken ? this.tokenHash(refreshToken) : undefined;
    const where = { sessionType: SessionType.MOBILE, OR: [...(tokenHash ? [{ tokenHash }] : []), ...(refreshTokenHash ? [{ refreshTokenHash }] : [])] };
    const session = await this.prisma.session.findFirst({ where, select: { userId: true, sessionType: true } });
    await this.prisma.session.deleteMany({ where });
    if (session?.sessionType === SessionType.MOBILE) await this.audit?.record({ actorUserId: session.userId, action: "USER_LOGOUT" });
  }

  private temporaryPassword() {
    const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lower = "abcdefghijkmnopqrstuvwxyz";
    const digits = "23456789";
    const symbols = "@#$%^&*";
    const pick = (chars: string) => chars[randomInt(chars.length)];
    const required = [pick(upper), pick(lower), pick(digits), pick(symbols)];
    const all = upper + lower + digits + symbols;
    while (required.length < 14) required.push(pick(all));
    for (let index = required.length - 1; index > 0; index -= 1) {
      const swapIndex = randomInt(index + 1);
      [required[index], required[swapIndex]] = [required[swapIndex], required[index]];
    }
    return required.join("");
  }

  async resetPassword(targetUserId: string, adminUserId: string, ipAddress?: string, userAgent?: string) {
    const temporaryPassword = this.temporaryPassword();
    assertPasswordPolicy(temporaryPassword);
    const passwordHash = await this.passwords.hash(temporaryPassword);
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: targetUserId, role: UserRole.VIEWER, status: UserStatus.ACTIVE, isActive: true, memberships: { some: { status: MembershipStatus.ACTIVE } } },
        select: { id: true },
      });
      if (!user) throw new UnauthorizedException("Account reset is unavailable");
      await tx.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: true } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      return { userId: user.id };
    });
    await this.audit?.record({ actorUserId: adminUserId, action: "PASSWORD_RESET", targetUserId: result.userId, metadata: { reason: "ADMIN_RESET_PASSWORD" }, ipAddress, userAgent });
    return { userId: result.userId, temporaryPassword };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, passwordHash: true } });
    if (!user?.passwordHash || !(await this.passwords.verify(currentPassword, user.passwordHash))) throw new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Current password is incorrect" });
    assertPasswordPolicy(newPassword);
    const passwordHash = await this.passwords.hash(newPassword);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash, mustChangePassword: false } });
    await this.audit?.record({ actorUserId: user.id, action: "PASSWORD_CHANGED" });
    return { success: true };
  }
}
