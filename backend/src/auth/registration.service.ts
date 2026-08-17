import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MembershipStatus, RegistrationRequestStatus, UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { CreateRegistrationRequestDto } from "./registration.dto";
import { PasswordService } from "./password.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuditLogService } from "./audit-log.service";
import { assertPasswordPolicy } from "./password-policy";

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService, private readonly rateLimiter?: AuthRateLimitService, private readonly audit?: AuditLogService) {}

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
      where: { status: MembershipStatus.ACTIVE, user: { role: UserRole.VIEWER, status: UserStatus.ACTIVE, isActive: true } },
      select: {
        id: true,
        userId: true,
        role: true,
        approvedAt: true,
        approvedBy: { select: { id: true, displayName: true, email: true } },
        user: { select: { id: true, displayName: true, employeeId: true, email: true } },
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
      approvedAt: membership.approvedAt,
      approvedBy: membership.approvedBy,
    }));
  }

  async approve(registrationId: string, adminUserId: string, ipAddress?: string, userAgent?: string) { return this.setApproval(registrationId, adminUserId, MembershipStatus.ACTIVE, ipAddress, userAgent); }
  async reject(registrationId: string, adminUserId: string, ipAddress?: string, userAgent?: string) { return this.setApproval(registrationId, adminUserId, MembershipStatus.REJECTED, ipAddress, userAgent); }

  private async setApproval(registrationId: string, adminUserId: string, status: MembershipStatus, ipAddress?: string, userAgent?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const request = await tx.registrationRequest.findUnique({ where: { id: registrationId } });
      if (!request?.createdUserId || request.status !== RegistrationRequestStatus.PENDING_APPROVAL) throw new NotFoundException("Pending registration not found");
      const membership = await tx.userStoreMembership.findUnique({ where: { userId_storeId: { userId: request.createdUserId, storeId: request.storeId } } });
      if (!membership || membership.status !== MembershipStatus.PENDING_APPROVAL) throw new ConflictException("Registration is no longer pending approval");
      const approvedAt = new Date();
      await tx.userStoreMembership.update({ where: { id: membership.id }, data: { status, approvedAt, approvedById: adminUserId } });
      await tx.user.update({ where: { id: request.createdUserId }, data: { status: status === MembershipStatus.ACTIVE ? UserStatus.ACTIVE : UserStatus.REJECTED } });
      await tx.registrationRequest.update({ where: { id: request.id }, data: { status: status === MembershipStatus.ACTIVE ? RegistrationRequestStatus.APPROVED : RegistrationRequestStatus.REJECTED } });
      return { registrationId: request.id, userId: request.createdUserId, status };
    });
    await this.audit?.record({ actorUserId: adminUserId, action: status === MembershipStatus.ACTIVE ? "ADMIN_APPROVE_REGISTRATION" : "ADMIN_REJECT_REGISTRATION", targetUserId: result.userId, targetRegistrationId: result.registrationId, ipAddress, userAgent });
    return result;
  }

}
