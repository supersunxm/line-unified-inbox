import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { Prisma, SessionType } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { PasswordService } from "./password.service";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService) {}
  private tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
  private safeUser(user: { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER"; isActive: boolean; status?: string; phone?: string | null; firstName?: string | null; lastName?: string | null; employeeId?: string | null; position?: string | null; memberships?: Array<{ id: string; storeId: string; role: string; store: { id: string; name: string; code: string | null } }> }) {
    const memberships = user.memberships?.map((membership) => ({ id: membership.id, storeId: membership.storeId, role: membership.role, store: membership.store })) ?? [];
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      status: user.status,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      employeeId: user.employeeId,
      position: user.position,
      memberships,
      stores: memberships.map((membership) => membership.store),
      profile: { firstName: user.firstName, lastName: user.lastName, employeeId: user.employeeId, position: user.position, phone: user.phone },
      permissions: {
        platformRole: user.role,
        membershipRoles: [...new Set(memberships.map((membership) => membership.role))],
        canAccessAllStores: user.role === "ADMIN",
        canReply: user.role === "ADMIN" || memberships.length > 0,
      },
    };
  }
  private userInclude = { memberships: { where: { status: "ACTIVE", store: { isActive: true, archivedAt: null } }, select: { id: true, storeId: true, role: true, store: { select: { id: true, name: true, code: true } } } } } as const;
  async login(email: string, password: string) {
    const identifier = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { OR: [{ normalizedEmail: identifier }, { username: identifier }] }, include: this.userInclude });
    if (!user || !user.isActive || !user.passwordHash || !(await this.passwords.verify(password, user.passwordHash))) { this.logger.warn(JSON.stringify({ event: "login_failure", reason: "invalid_credentials" })); throw new UnauthorizedException("Invalid email or password"); }
    const { token, expiresAt } = await this.createSession(user.id, SessionType.WEB);
    this.logger.log(JSON.stringify({ event: "login_success", userId: user.id, role: user.role }));
    return { token, expiresAt, user: this.safeUser(user) };
  }
  async authenticate(token?: string) {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: this.tokenHash(token) }, include: { user: { include: this.userInclude } } });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
    return this.safeUser(session.user);
  }
  async logout(token?: string) { if (token) await this.prisma.session.deleteMany({ where: { tokenHash: this.tokenHash(token) } }); }
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
    await this.prisma.session.deleteMany({ where: { tokenHash: this.tokenHash(token), sessionType: SessionType.MOBILE } });
  }
}
