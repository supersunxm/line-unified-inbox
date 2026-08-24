import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { MembershipStatus, Prisma, SessionType, UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { PasswordService } from "./password.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuditLogService } from "./audit-log.service";
import { assertPasswordPolicy } from "./password-policy";
import { buildPermissionContext } from "./permission-context";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService, private readonly rateLimiter?: AuthRateLimitService, private readonly audit?: AuditLogService) {}
  private tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
  private safeUser(user: { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER"; isActive: boolean; canAccessMainOa?: boolean; canManageMainOa?: boolean; status?: string; mustChangePassword?: boolean; phone?: string | null; firstName?: string | null; lastName?: string | null; employeeId?: string | null; position?: string | null; memberships?: Array<{ id: string; storeId: string; role: string; store: { id: string; name: string; code: string | null } }> }) {
    const memberships = user.memberships?.map((membership) => ({ id: membership.id, storeId: membership.storeId, role: membership.role, store: membership.store })) ?? [];
    const authorization = buildPermissionContext({
      role: user.role,
      canAccessMainOa: user.canAccessMainOa,
      canManageMainOa: user.canManageMainOa,
      memberships,
    });
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
        // Keep the existing flat permission contract for current Web/App clients.
        platformRole: authorization.identity.platformRole,
        membershipRoles: authorization.identity.membershipRoles,
        canAccessAllStores: authorization.scope.allStores,
        canReply: authorization.capabilities.reply,
        canAccessMainOa: authorization.capabilities.accessMainOa,
        canManageMainOa: authorization.capabilities.manageMainOa,
        // Add the normalized Stage 1 contract alongside the legacy keys.
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
  async login(email: string, password: string, sessionType: SessionType = SessionType.WEB, ip = "unknown", userAgent?: string) {
    const identifier = email.trim().toLowerCase();
    await this.rateLimiter?.assertLoginAllowed(ip, identifier);
    const user = await this.prisma.user.findFirst({ where: { OR: [{ normalizedEmail: identifier }, { username: identifier }] }, include: this.userInclude });
    if (!user || !user.passwordHash || !(await this.passwords.verify(password, user.passwordHash))) { await this.rateLimiter?.recordLoginFailure(ip, identifier); await this.audit?.record({ action: "USER_LOGIN_FAILED", targetUserId: user?.id, ipAddress: ip, userAgent }); this.logger.warn(JSON.stringify({ event: "login_failure", reason: "invalid_credentials" })); throw new UnauthorizedException({ code: "INVALID_CREDENTIALS", message: "Invalid email or password" }); }
    const activeMemberships = user.memberships ?? [];
    if (!user.isActive || user.status === UserStatus.SUSPENDED) { await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_REJECTED", metadata: { reason: user.status === UserStatus.SUSPENDED ? "SUSPENDED" : "INACTIVE" }, ipAddress: ip, userAgent }); throw new UnauthorizedException({ code: "ACCOUNT_SUSPENDED", message: "Account is suspended" }); }
    if (user.status === UserStatus.PENDING_APPROVAL || activeMemberships.length === 0 && user.role !== "ADMIN" && !user.canAccessMainOa) { await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_REJECTED", metadata: { reason: user.status === UserStatus.PENDING_APPROVAL ? "PENDING_APPROVAL" : "NO_WORKSPACE_ACCESS" }, ipAddress: ip, userAgent }); throw new UnauthorizedException({ code: "ACCOUNT_PENDING_APPROVAL", message: "Account is pending approval" }); }
    if (user.status === UserStatus.REJECTED) { await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_REJECTED", metadata: { reason: "REJECTED" }, ipAddress: ip, userAgent }); throw new UnauthorizedException({ code: "ACCOUNT_REJECTED", message: "Account has been rejected" }); }
    const { token, expiresAt } = await this.createSession(user.id, sessionType);
    this.logger.log(JSON.stringify({ event: "login_success", userId: user.id, role: user.role }));
    await this.audit?.record({ actorUserId: user.id, action: "USER_LOGIN_SUCCESS", ipAddress: ip, userAgent });
    return { token, expiresAt, user: this.safeUser(user) };
  }
  async authenticate(token?: string) {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: this.tokenHash(token) }, include: { user: { include: this.userInclude } } });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive || session.user.status !== UserStatus.ACTIVE || (session.user.role !== "ADMIN" && session.user.memberships.length === 0 && !session.user.canAccessMainOa)) return null;
    return this.safeUser(session.user);
  }
  async logout(token?: string, ip?: string, userAgent?: string) { if (token) { const session = await this.prisma.session.findUnique({ where: { tokenHash: this.tokenHash(token) }, select: { userId: true } }); await this.prisma.session.deleteMany({ where: { tokenHash: this.tokenHash(token) } }); if (session) await this.audit?.record({ actorUserId: session.userId, action: "USER_LOGOUT", ipAddress: ip, userAgent }); } }
  async createSession(userId: string, sessionType: SessionType, client: Prisma.TransactionClient | PrismaService = this.prisma) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    const writes = [client.session.create({ data: { tokenHash: this.tokenHash(token), userId, sessionType, expiresAt } }), client.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } })];
    if (client === this.prisma) await this.prisma.$transaction(writes);
    else await Promise.all(writes);
    return { token, expiresAt };
  }
  async logoutMobile(token?: string) {
    if (!token) return;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: this.tokenHash(token) }, select: { userId: true, sessionType: true } });
    await this.prisma.session.deleteMany({ where: { tokenHash: this.tokenHash(token), sessionType: SessionType.MOBILE } });
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
