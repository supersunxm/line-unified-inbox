import { ForbiddenException, Injectable } from "@nestjs/common";
import { MembershipStatus, UserRole, UserStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { buildPermissionContext, hasWorkspaceAccess } from "../auth/permission-context";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import { RegisterDeviceTokenDto } from "./device-token.dto";

@Injectable()
export class DeviceTokenService {
  constructor(private readonly prisma: PrismaService, private readonly encryption: CredentialEncryptionService) {}

  private hash(value: string) { return createHash("sha256").update(value).digest("hex"); }

  private async assertEligibleUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        role: true,
        isActive: true,
        status: true,
        canAccessWeb: true,
        canAccessMobile: true,
        canAccessHq: true,
        canAccessAllStores: true,
        canManageAccounts: true,
        canReply: true,
        canAccessMainOa: true,
        canManageMainOa: true,
        memberships: { where: { status: MembershipStatus.ACTIVE, store: { isActive: true, archivedAt: null } }, select: { storeId: true, role: true } },
      },
    });
    const authorization = user && buildPermissionContext({
      role: user.role ?? UserRole.VIEWER,
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
    if (!user || !user.isActive || user.status !== UserStatus.ACTIVE || !authorization?.platforms.mobile || !hasWorkspaceAccess(authorization)) {
      throw new ForbiddenException("An active mobile workspace permission is required to register a device");
    }
  }

  async register(userId: string, dto: RegisterDeviceTokenDto) {
    await this.assertEligibleUser(userId);
    const token = dto.token.trim();
    const now = new Date();
    const tokenHash = this.hash(token);
    const deviceIdHash = dto.deviceId?.trim() ? this.hash(dto.deviceId.trim()) : undefined;
    const encryptedToken = this.encryption.encrypt(token);
    const record = await this.prisma.deviceToken.upsert({
      where: { tokenHash },
      create: { userId, token: encryptedToken, tokenHash, platform: dto.platform, appVersion: dto.appVersion?.trim(), deviceIdHash, isActive: true, lastSeenAt: now },
      update: { userId, token: encryptedToken, platform: dto.platform, appVersion: dto.appVersion?.trim(), deviceIdHash, isActive: true, lastSeenAt: now },
      select: { id: true, platform: true, isActive: true, lastSeenAt: true },
    });
    return record;
  }

  async unregister(userId: string, rawToken: string) {
    const tokenHash = this.hash(rawToken.trim());
    await this.prisma.deviceToken.updateMany({ where: { userId, tokenHash, isActive: true }, data: { isActive: false, lastSeenAt: new Date() } });
    return { success: true };
  }

  async touch(userId: string, rawToken: string) {
    const tokenHash = this.hash(rawToken.trim());
    await this.prisma.deviceToken.updateMany({ where: { userId, tokenHash, isActive: true }, data: { lastSeenAt: new Date() } });
    return { success: true };
  }
}
