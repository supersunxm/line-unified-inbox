import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { MembershipStatus, MobileOtpPurpose, Prisma, RegistrationRequestStatus, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { normalizeThaiMobilePhone } from "./phone-normalization";
import { OtpChallengeService } from "./otp-challenge.service";
import { CreateRegistrationRequestDto } from "./registration.dto";

@Injectable()
export class RegistrationService {
  constructor(private readonly prisma: PrismaService, private readonly otp: OtpChallengeService) {}

  async stores() {
    return this.prisma.store.findMany({ where: { isActive: true, archivedAt: null }, select: { id: true, name: true, code: true }, orderBy: { name: "asc" } });
  }

  async request(dto: CreateRegistrationRequestDto) {
    const normalizedPhone = normalizeThaiMobilePhone(dto.phone);
    const normalizedEmail = dto.email.trim().toLowerCase();
    const now = new Date();
    const store = await this.prisma.store.findUnique({ where: { id: dto.storeId }, select: { id: true, isActive: true, archivedAt: true } });
    if (!store || !store.isActive || store.archivedAt) throw new NotFoundException("Store is unavailable for registration");
    const existingUser = await this.prisma.user.findUnique({ where: { phone: normalizedPhone }, select: { id: true, isActive: true, status: true } });
    if (existingUser?.isActive && existingUser.status === "ACTIVE") throw new ConflictException("A user with this phone number already exists");
    if (existingUser) throw new ConflictException("This phone number is unavailable");
    const pending = await this.prisma.registrationRequest.findFirst({ where: { phone: normalizedPhone, status: RegistrationRequestStatus.OTP_PENDING, expiresAt: { gt: now } }, select: { id: true } });
    if (pending) throw new ConflictException("A registration verification is already pending");

    const registration = await this.prisma.$transaction(async (tx) => {
      const request = await tx.registrationRequest.create({
        data: {
          storeId: store.id,
          email: dto.email.trim(),
          normalizedEmail,
          phone: normalizedPhone,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          employeeId: dto.employeeId.trim(),
          position: dto.position.trim(),
          requestedRole: dto.requestedRole,
          expiresAt: new Date(now.getTime() + 30 * 60_000),
        },
      });
      const challenge = await this.otp.create(tx, { registrationId: request.id, normalizedPhone, purpose: MobileOtpPurpose.BM_STAFF_REGISTRATION });
      return { request, challenge };
    });
    return { registrationId: registration.request.id, challengeId: registration.challenge.id, expiresAt: registration.challenge.expiresAt, delivery: "NOT_CONFIGURED" as const };
  }

  async verify(registrationId: string, otpCode: string) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.registrationRequest.findUnique({ where: { id: registrationId } });
      if (!request) throw new NotFoundException("Registration request not found");
      if (request.status === RegistrationRequestStatus.COMPLETED && request.createdUserId) return this.completedResult(tx, request.id, request.createdUserId);
      if (request.status !== RegistrationRequestStatus.OTP_PENDING || request.expiresAt <= new Date()) throw new BadRequestException("Registration request is unavailable");
      const challenge = await tx.otpChallenge.findFirst({ where: { registrationId: request.id, purpose: MobileOtpPurpose.BM_STAFF_REGISTRATION }, orderBy: { createdAt: "desc" } });
      if (!challenge) throw new BadRequestException("Verification challenge is unavailable");
      await this.otp.verify(tx, challenge, otpCode);

      const existingUser = await tx.user.findUnique({ where: { phone: request.phone }, select: { id: true } });
      if (existingUser) throw new ConflictException("This phone number is unavailable");
      const verifiedAt = new Date();
      const user = await tx.user.create({
        data: {
          email: request.email,
          normalizedEmail: request.normalizedEmail,
          displayName: `${request.firstName} ${request.lastName}`,
          phone: request.phone,
          firstName: request.firstName,
          lastName: request.lastName,
          employeeId: request.employeeId,
          position: request.position,
          phoneVerifiedAt: verifiedAt,
          role: UserRole.VIEWER,
          status: "ACTIVE",
        },
      });
      await tx.userStoreMembership.create({ data: { userId: user.id, storeId: request.storeId, role: request.requestedRole, status: MembershipStatus.PENDING_APPROVAL } });
      await tx.registrationRequest.update({ where: { id: request.id }, data: { otpVerifiedAt: verifiedAt, createdUserId: user.id, status: RegistrationRequestStatus.COMPLETED } });
      return { registrationId: request.id, userId: user.id, status: MembershipStatus.PENDING_APPROVAL };
    });
  }

  async pending() {
    const requests = await this.prisma.registrationRequest.findMany({
      where: { status: RegistrationRequestStatus.COMPLETED, createdUserId: { not: null } },
      include: { store: { select: { id: true, name: true, code: true } }, createdUser: { include: { memberships: true } } },
      orderBy: { updatedAt: "asc" },
    });
    return requests.filter((request) => request.createdUser?.memberships.some((membership) => membership.storeId === request.storeId && membership.status === MembershipStatus.PENDING_APPROVAL));
  }

  async approve(registrationId: string, adminUserId: string) { return this.setApproval(registrationId, adminUserId, MembershipStatus.ACTIVE); }
  async reject(registrationId: string, adminUserId: string) { return this.setApproval(registrationId, adminUserId, MembershipStatus.REJECTED); }

  private async setApproval(registrationId: string, adminUserId: string, status: MembershipStatus) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.registrationRequest.findUnique({ where: { id: registrationId } });
      if (!request?.createdUserId || request.status !== RegistrationRequestStatus.COMPLETED) throw new NotFoundException("Pending registration not found");
      const membership = await tx.userStoreMembership.findUnique({ where: { userId_storeId: { userId: request.createdUserId, storeId: request.storeId } } });
      if (!membership || membership.status !== MembershipStatus.PENDING_APPROVAL) throw new ConflictException("Registration is no longer pending approval");
      const approvedAt = new Date();
      await tx.userStoreMembership.update({ where: { id: membership.id }, data: { status, approvedAt, approvedById: adminUserId } });
      if (status === MembershipStatus.REJECTED) await tx.registrationRequest.update({ where: { id: request.id }, data: { status: RegistrationRequestStatus.REJECTED } });
      return { registrationId: request.id, userId: request.createdUserId, status };
    });
  }

  private async completedResult(tx: Prisma.TransactionClient, registrationId: string, userId: string) {
    const membership = await tx.userStoreMembership.findFirst({ where: { userId }, select: { status: true } });
    return { registrationId, userId, status: membership?.status ?? MembershipStatus.PENDING_APPROVAL };
  }
}
