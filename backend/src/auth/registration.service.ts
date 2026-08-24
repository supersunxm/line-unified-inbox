import { ConflictException, Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { MembershipStatus, RegistrationRequestStatus, UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { EmailService } from "../email/email.service";
import { CreateRegistrationRequestDto } from "./registration.dto";
import { PasswordService } from "./password.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuditLogService } from "./audit-log.service";
import { assertPasswordPolicy } from "./password-policy";

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name);
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService, private readonly rateLimiter?: AuthRateLimitService, private readonly audit?: AuditLogService, @Optional() private readonly email?: EmailService) {}

  private lifecycleResult(userId: string, accountStatus: "ACTIVE" | "INACTIVE", membershipStatus: "ACTIVE" | "INACTIVE", changed: boolean, membershipId?: string) {
    return { userId, accountStatus, membershipStatus, changed, ...(membershipId ? { membershipId } : {}) };
  }

  async stores() {
    return this.prisma.store.findMany({ where: { isActive: true, archivedAt: null }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
  }

  async request(dto: CreateRegistrationRequestDto, ip = "unknown") {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const employeeId = dto.employeeId.trim().toUpperCase();
    if (!employeeId) throw new ConflictException("Employee ID is required");
    await this.rateLimiter?.consumeRegistration(ip);
    assertPasswordPolicy(dto.password);
    const store = await this.prisma.store.findUnique({ where: { id: dto.storeId }, select: { id: true, isActive: true, archivedAt: true } });
    if (!store || !store.isActive || store.archivedAt) throw new NotFoundException("Store is unavailable for registration");
    if (await this.prisma.user.findUnique({ where: { normalizedEmail }, select: { id: true } })) throw new ConflictException("An account with this email already exists");
    if (await this.prisma.user.findFirst({ where: { employeeId: { equals: employeeId, mode: "insensitive" } }, select: { id: true } })) throw new ConflictException("Employee ID is already registered");
    if (await this.prisma.registrationRequest.findFirst({ where: { normalizedEmail, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60_000) } }, select: { id: true } })) throw new ConflictException("A registration for this email was recently submitted");
    const passwordHash = await this.passwords.hash(dto.password);
    const registration = await this.prisma.$transaction(async (tx) => {
      const name = dto.name.trim();
      const request = await tx.registrationRequest.create({
        data: {
          storeId: store.id,
          email: dto.email.trim(),
          normalizedEmail,
          employeeId,
          passwordHash,
          requestedRole: dto.role,
          status: RegistrationRequestStatus.PENDING_APPROVAL,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000),
        },
      });
      const user = await tx.user.create({ data: { email: dto.email.trim(), normalizedEmail, displayName: name, employeeId, passwordHash, role: UserRole.VIEWER, status: UserStatus.PENDING_APPROVAL, isActive: true } });
      await tx.userStoreMembership.create({ data: { userId: user.id, storeId: store.id, role: dto.role, status: MembershipStatus.PENDING_APPROVAL } });
      await tx.registrationRequest.update({ where: { id: request.id }, data: { createdUserId: user.id } });
      return { request, user };
    });
    return { registrationId: registration.request.id, userId: registration.user.id, status: RegistrationRequestStatus.PENDING_APPROVAL };
  }

  async pending() {
    const requests = await this.prisma.registrationRequest.findMany({
      where: { status: RegistrationRequestStatus.PENDING_APPROVAL, createdUserId: { not: null }, expiresAt: { gt: new Date() } },
      include: { store: { select: { id: true, name: true, code: true } }, createdUser: { include: { memberships: true } } },
      orderBy: { updatedAt: "asc" },
    });
    return requests.filter((request) => request.createdUser?.memberships.some((membership) => membership.storeId === request.storeId && membership.status === MembershipStatus.PENDING_APPROVAL)).map((request) => {
      const membership = request.createdUser!.memberships.find((item) => item.storeId === request.storeId);
      return { id: request.id, name: request.createdUser!.displayName, employeeId: request.createdUser!.employeeId ?? request.employeeId, email: request.email, store: request.store, role: membership?.role ?? request.requestedRole, createdAt: request.createdAt };
    });
  }

  async approved() {
    const memberships = await this.prisma.userStoreMembership.findMany({
      where: {
        status: { in: [MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED] },
        user: { role: UserRole.VIEWER, status: { in: [UserStatus.ACTIVE, UserStatus.SUSPENDED] } },
      },
      select: {
        id: true,
        userId: true,
        role: true,
        status: true,
        approvedAt: true,
        approvedBy: { select: { id: true, displayName: true, email: true } },
        user: { select: { id: true, displayName: true, employeeId: true, email: true, isActive: true } },
        store: { select: { id: true, name: true, code: true } },
      },
      orderBy: { approvedAt: "desc" },
    });
    return memberships.map((membership) => ({
      id: membership.id,
      userId: membership.userId,
      name: membership.user.displayName,
      employeeId: membership.user.employeeId,
      email: membership.user.email,
      store: membership.store,
      role: membership.role,
      accountStatus: membership.user.isActive ? "ACTIVE" : "INACTIVE",
      membershipStatus: membership.status === MembershipStatus.ACTIVE ? "ACTIVE" : "INACTIVE",
      approvedAt: membership.approvedAt,
      approvedBy: membership.approvedBy,
    }));
  }

  async deactivateAccount(userId: string, adminUserId: string, ipAddress?: string, userAgent?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          isActive: true,
          status: true,
          memberships: {
            where: { status: MembershipStatus.ACTIVE },
            select: { id: true, storeId: true },
          },
        },
      });
      if (!user || user.role !== UserRole.VIEWER || user.status === UserStatus.REJECTED || user.status === UserStatus.PENDING_APPROVAL) {
        throw new NotFoundException("Approved account not found");
      }
      if (!user.isActive || user.status === UserStatus.SUSPENDED) {
        return this.lifecycleResult(user.id, "INACTIVE", "INACTIVE", false);
      }
      if (user.memberships.length === 0) throw new ConflictException("Account has no active store membership");

      const userUpdate = await tx.user.updateMany({
        where: { id: user.id, role: UserRole.VIEWER, isActive: true, status: UserStatus.ACTIVE },
        data: { isActive: false, status: UserStatus.SUSPENDED },
      });
      if (userUpdate.count !== 1) {
        const latest = await tx.user.findUnique({ where: { id: user.id }, select: { isActive: true, status: true } });
        if (latest && (!latest.isActive || latest.status === UserStatus.SUSPENDED)) return this.lifecycleResult(user.id, "INACTIVE", "INACTIVE", false);
        throw new ConflictException("Account changed while it was being deactivated");
      }
      await tx.userStoreMembership.updateMany({ where: { userId: user.id, status: MembershipStatus.ACTIVE }, data: { status: MembershipStatus.SUSPENDED } });
      await tx.session.deleteMany({ where: { userId: user.id } });
      await tx.deviceToken.updateMany({ where: { userId: user.id, isActive: true }, data: { isActive: false, lastSeenAt: new Date() } });
      return this.lifecycleResult(user.id, "INACTIVE", "INACTIVE", true);
    });
    if (result.changed) {
      await this.audit?.record({ actorUserId: adminUserId, action: "ADMIN_DEACTIVATE_ACCOUNT", targetUserId: result.userId, metadata: { accountStatus: result.accountStatus, membershipStatus: result.membershipStatus }, ipAddress, userAgent });
    }
    return result;
  }

  async reactivateAccount(userId: string, adminUserId: string, ipAddress?: string, userAgent?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          role: true,
          isActive: true,
          status: true,
          memberships: {
            where: { status: { in: [MembershipStatus.ACTIVE, MembershipStatus.SUSPENDED] } },
            select: { id: true, storeId: true, status: true, isPrimary: true, approvedAt: true, createdAt: true },
            orderBy: [{ isPrimary: "desc" }, { approvedAt: "desc" }, { createdAt: "desc" }],
          },
        },
      });
      if (!user || user.role !== UserRole.VIEWER) throw new NotFoundException("Account not found");
      if (user.isActive && user.status === UserStatus.ACTIVE) {
        return this.lifecycleResult(user.id, "ACTIVE", user.memberships.some((membership) => membership.status === MembershipStatus.ACTIVE) ? "ACTIVE" : "INACTIVE", false, user.memberships.find((membership) => membership.status === MembershipStatus.ACTIVE)?.id);
      }
      if (user.status !== UserStatus.SUSPENDED && user.status !== UserStatus.ACTIVE) throw new ConflictException("Account cannot be reactivated");
      const membership = user.memberships[0];
      if (!membership) throw new ConflictException("No current store membership is available to restore");

      const userUpdate = await tx.user.updateMany({ where: { id: user.id, role: UserRole.VIEWER, isActive: false, status: { in: [UserStatus.SUSPENDED, UserStatus.ACTIVE] } }, data: { isActive: true, status: UserStatus.ACTIVE } });
      if (userUpdate.count !== 1) {
        const latest = await tx.user.findUnique({ where: { id: user.id }, select: { isActive: true, status: true } });
        if (latest?.isActive && latest.status === UserStatus.ACTIVE) return this.lifecycleResult(user.id, "ACTIVE", "ACTIVE", false, membership.id);
        throw new ConflictException("Account changed while it was being reactivated");
      }
      if (membership.status === MembershipStatus.SUSPENDED) {
        await tx.userStoreMembership.updateMany({ where: { id: membership.id, status: MembershipStatus.SUSPENDED }, data: { status: MembershipStatus.ACTIVE } });
      }
      return this.lifecycleResult(user.id, "ACTIVE", "ACTIVE", true, membership.id);
    });
    if (result.changed) {
      await this.audit?.record({ actorUserId: adminUserId, action: "ADMIN_REACTIVATE_ACCOUNT", targetUserId: result.userId, metadata: { accountStatus: result.accountStatus, membershipStatus: result.membershipStatus, membershipId: result.membershipId ?? null }, ipAddress, userAgent });
    }
    return result;
  }

  async approve(registrationId: string, adminUserId: string, ipAddress?: string, userAgent?: string) { return this.setApproval(registrationId, adminUserId, MembershipStatus.ACTIVE, ipAddress, userAgent); }
  async reject(registrationId: string, adminUserId: string, ipAddress?: string, userAgent?: string) { return this.setApproval(registrationId, adminUserId, MembershipStatus.REJECTED, ipAddress, userAgent); }

  private async setApproval(registrationId: string, adminUserId: string, status: MembershipStatus, ipAddress?: string, userAgent?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.registrationRequest.findUnique({ where: { id: registrationId } });
      if (!request?.createdUserId || request.status !== RegistrationRequestStatus.PENDING_APPROVAL) throw new NotFoundException("Pending registration not found");
      const membership = await tx.userStoreMembership.findUnique({
        where: { userId_storeId: { userId: request.createdUserId, storeId: request.storeId } },
        select: { id: true, status: true, role: true, user: { select: { email: true, displayName: true } }, store: { select: { name: true } } },
      });
      if (!membership || membership.status !== MembershipStatus.PENDING_APPROVAL) throw new ConflictException("Registration is no longer pending approval");
      const approvedAt = new Date();
      const membershipUpdate = await tx.userStoreMembership.updateMany({ where: { id: membership.id, status: MembershipStatus.PENDING_APPROVAL }, data: { status, approvedAt, approvedById: adminUserId } });
      if (membershipUpdate.count !== 1) throw new ConflictException("Registration is no longer pending approval");
      const userUpdate = await tx.user.updateMany({ where: { id: request.createdUserId, status: UserStatus.PENDING_APPROVAL }, data: { status: status === MembershipStatus.ACTIVE ? UserStatus.ACTIVE : UserStatus.REJECTED } });
      if (userUpdate.count !== 1) throw new ConflictException("Registration user is no longer pending approval");
      const requestUpdate = await tx.registrationRequest.updateMany({ where: { id: request.id, status: RegistrationRequestStatus.PENDING_APPROVAL }, data: { status: status === MembershipStatus.ACTIVE ? RegistrationRequestStatus.APPROVED : RegistrationRequestStatus.REJECTED } });
      if (requestUpdate.count !== 1) throw new ConflictException("Registration is no longer pending approval");
      return {
        result: { registrationId: request.id, userId: request.createdUserId, status },
        notification: { to: membership.user.email, displayName: membership.user.displayName, storeName: membership.store.name, role: membership.role },
      };
    });
    await this.audit?.record({ actorUserId: adminUserId, action: status === MembershipStatus.ACTIVE ? "ADMIN_APPROVE_REGISTRATION" : "ADMIN_REJECT_REGISTRATION", targetUserId: result.result.userId, targetRegistrationId: result.result.registrationId, ipAddress, userAgent });
    if (status !== MembershipStatus.ACTIVE) return result.result;
    const notificationStatus = await this.sendApprovalNotification(result.notification);
    return { ...result.result, notification: { status: notificationStatus } };
  }

  private async sendApprovalNotification(input: { to: string; displayName: string; storeName: string; role: "STAFF" | "STORE_MANAGER" }) {
    if (!this.email) {
      this.logger.warn(JSON.stringify({ event: "approval_notification_failed", reason: "email_service_unavailable" }));
      return "failed" as const;
    }
    try {
      await this.email.sendAccountApproved(input);
      return "sent" as const;
    } catch {
      this.logger.warn(JSON.stringify({ event: "approval_notification_failed", reason: "email_delivery_failed" }));
      return "failed" as const;
    }
  }

}
