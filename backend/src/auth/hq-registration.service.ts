import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { PasswordService } from "./password.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuditLogService } from "./audit-log.service";
import { assertPasswordPolicy } from "./password-policy";

@Injectable()
export class HqRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly rateLimiter?: AuthRateLimitService,
    private readonly audit?: AuditLogService,
  ) {}

  private hqIdentityWhere() {
    return {
      role: UserRole.ADMIN,
      canAccessHq: true,
      canAccessAllStores: true,
      canManageAccounts: true,
      username: null,
      employeeId: { not: null },
    } as const;
  }

  async request(input: { name: string; employeeId: string; email: string; password: string }, ip = "unknown") {
    const normalizedEmail = input.email.trim().toLowerCase();
    const employeeId = input.employeeId.trim().toUpperCase();
    const name = input.name.trim();

    if (!name) throw new ConflictException("Name is required");
    if (!employeeId) throw new ConflictException("Employee ID is required");
    await this.rateLimiter?.consumeRegistration(ip);
    assertPasswordPolicy(input.password);

    if (await this.prisma.user.findUnique({ where: { normalizedEmail }, select: { id: true } })) {
      throw new ConflictException("An account with this email already exists");
    }
    if (await this.prisma.user.findFirst({ where: { employeeId: { equals: employeeId, mode: "insensitive" } }, select: { id: true } })) {
      throw new ConflictException("Employee ID is already registered");
    }

    const passwordHash = await this.passwords.hash(input.password);
    const user = await this.prisma.user.create({
      data: {
        email: input.email.trim(),
        normalizedEmail,
        displayName: name,
        employeeId,
        passwordHash,
        role: UserRole.ADMIN,
        status: UserStatus.PENDING_APPROVAL,
        isActive: true,
        canAccessWeb: true,
        canAccessMobile: true,
        canAccessHq: true,
        canAccessAllStores: true,
        canManageAccounts: true,
        canReply: true,
        canAccessMainOa: true,
        canManageMainOa: true,
      },
      select: { id: true },
    });

    await this.audit?.record({ action: "HQ_REGISTRATION_REQUESTED", targetUserId: user.id, metadata: { employeeId }, ipAddress: ip });
    return { userId: user.id, status: UserStatus.PENDING_APPROVAL, accountType: "HQ" as const };
  }

  async pending() {
    return this.prisma.user.findMany({
      where: {
        ...this.hqIdentityWhere(),
        status: UserStatus.PENDING_APPROVAL,
        isActive: true,
      },
      select: { id: true, displayName: true, employeeId: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
  }

  async approved() {
    return this.prisma.user.findMany({
      where: {
        ...this.hqIdentityWhere(),
        status: { in: [UserStatus.ACTIVE, UserStatus.SUSPENDED] },
      },
      select: {
        id: true,
        displayName: true,
        employeeId: true,
        email: true,
        status: true,
        isActive: true,
        canAccessWeb: true,
        canAccessMobile: true,
        canAccessHq: true,
        canAccessAllStores: true,
        canManageAccounts: true,
        canReply: true,
        canAccessMainOa: true,
        canManageMainOa: true,
        createdAt: true,
        lastLoginAt: true,
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    });
  }

  private async assertApprover(actorUserId: string) {
    const actor = await this.prisma.user.findUnique({
      where: { id: actorUserId },
      select: { role: true, status: true, isActive: true, canManageAccounts: true },
    });
    if (!actor || actor.role !== UserRole.ADMIN || actor.status !== UserStatus.ACTIVE || !actor.isActive || !actor.canManageAccounts) {
      throw new ForbiddenException("Only an active full-access administrator can manage HQ accounts");
    }
  }

  async approve(userId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    await this.assertApprover(actorUserId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...this.hqIdentityWhere(), status: UserStatus.PENDING_APPROVAL },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("Pending HQ account not found");

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        isActive: true,
        role: UserRole.ADMIN,
        canAccessWeb: true,
        canAccessMobile: true,
        canAccessHq: true,
        canAccessAllStores: true,
        canManageAccounts: true,
        canReply: true,
        canAccessMainOa: true,
        canManageMainOa: true,
      },
    });

    await this.audit?.record({ actorUserId, action: "HQ_ACCOUNT_APPROVED", targetUserId: user.id, metadata: { fullAccess: true }, ipAddress, userAgent });
    return { userId: user.id, status: UserStatus.ACTIVE, accountType: "HQ" as const, fullAccess: true };
  }

  async reject(userId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    await this.assertApprover(actorUserId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...this.hqIdentityWhere(), status: UserStatus.PENDING_APPROVAL },
      select: { id: true },
    });
    if (!user) throw new NotFoundException("Pending HQ account not found");

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          status: UserStatus.REJECTED,
          isActive: false,
          passwordHash: null,
          canAccessWeb: false,
          canAccessMobile: false,
          canAccessHq: false,
          canAccessAllStores: false,
          canManageAccounts: false,
          canReply: false,
          canAccessMainOa: false,
          canManageMainOa: false,
        },
      }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
      this.prisma.deviceToken.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false, lastSeenAt: new Date() } }),
    ]);

    await this.audit?.record({ actorUserId, action: "HQ_ACCOUNT_REJECTED", targetUserId: user.id, ipAddress, userAgent });
    return { userId: user.id, status: UserStatus.REJECTED, accountType: "HQ" as const };
  }

  async deactivate(userId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    await this.assertApprover(actorUserId);
    if (userId === actorUserId) throw new ForbiddenException("You cannot deactivate your own HQ account");
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...this.hqIdentityWhere(), status: { in: [UserStatus.ACTIVE, UserStatus.SUSPENDED] } },
      select: { id: true, status: true, isActive: true },
    });
    if (!user) throw new NotFoundException("HQ account not found");
    if (!user.isActive || user.status === UserStatus.SUSPENDED) return { userId: user.id, status: UserStatus.SUSPENDED, changed: false };

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { isActive: false, status: UserStatus.SUSPENDED } }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
      this.prisma.deviceToken.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false, lastSeenAt: new Date() } }),
    ]);
    await this.audit?.record({ actorUserId, action: "HQ_ACCOUNT_DEACTIVATED", targetUserId: user.id, ipAddress, userAgent });
    return { userId: user.id, status: UserStatus.SUSPENDED, changed: true };
  }

  async reactivate(userId: string, actorUserId: string, ipAddress?: string, userAgent?: string) {
    await this.assertApprover(actorUserId);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...this.hqIdentityWhere(), status: { in: [UserStatus.ACTIVE, UserStatus.SUSPENDED] } },
      select: { id: true, status: true, isActive: true },
    });
    if (!user) throw new NotFoundException("HQ account not found");
    if (user.isActive && user.status === UserStatus.ACTIVE) return { userId: user.id, status: UserStatus.ACTIVE, changed: false };

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        status: UserStatus.ACTIVE,
        canAccessWeb: true,
        canAccessMobile: true,
        canAccessHq: true,
        canAccessAllStores: true,
        canManageAccounts: true,
        canReply: true,
        canAccessMainOa: true,
        canManageMainOa: true,
      },
    });
    await this.audit?.record({ actorUserId, action: "HQ_ACCOUNT_REACTIVATED", targetUserId: user.id, ipAddress, userAgent });
    return { userId: user.id, status: UserStatus.ACTIVE, changed: true };
  }
}
