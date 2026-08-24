import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { MembershipStatus, MobileOtpPurpose, SessionType, UserRole, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { AuthService } from "./auth.service";
import { OtpChallengeService } from "./otp-challenge.service";
import { normalizeThaiMobilePhone } from "./phone-normalization";
import { buildPermissionContext, hasWorkspaceAccess } from "./permission-context";
import { SMS_PROVIDER, SmsProvider } from "./sms-provider";

type MobileLoginUser = {
  id: string;
  role?: UserRole;
  isActive: boolean;
  status: UserStatus;
  canAccessWeb?: boolean;
  canAccessMobile?: boolean;
  canAccessHq?: boolean;
  canAccessAllStores?: boolean;
  canManageAccounts?: boolean;
  canReply?: boolean;
  canAccessMainOa?: boolean;
  canManageMainOa?: boolean;
  memberships: Array<{ storeId?: string; role?: string }>;
};

@Injectable()
export class MobileAuthService {
  constructor(private readonly prisma: PrismaService, private readonly otp: OtpChallengeService, private readonly auth: AuthService, @Inject(SMS_PROVIDER) private readonly sms: SmsProvider) {}

  private isEligible(user: MobileLoginUser | null | undefined) {
    if (!user?.isActive || user.status !== UserStatus.ACTIVE) return false;
    const authorization = buildPermissionContext({
      role: user.role ?? UserRole.VIEWER,
      canAccessWeb: user.canAccessWeb,
      canAccessMobile: user.canAccessMobile,
      canAccessHq: user.canAccessHq,
      canAccessAllStores: user.canAccessAllStores,
      canManageAccounts: user.canManageAccounts,
      canReply: user.canReply,
      canAccessMainOa: user.canAccessMainOa,
      canManageMainOa: user.canManageMainOa,
      memberships: user.memberships.map((membership, index) => ({
        storeId: membership.storeId ?? `legacy-store-${index}`,
        role: membership.role ?? "STAFF",
      })),
    });
    return authorization.platforms.mobile && hasWorkspaceAccess(authorization);
  }

  private userSelect = {
    id: true,
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
    memberships: {
      where: { status: MembershipStatus.ACTIVE, store: { isActive: true, archivedAt: null } },
      select: { storeId: true, role: true },
    },
  } as const;

  async sendOtp(rawPhone: string) {
    const normalizedPhone = normalizeThaiMobilePhone(rawPhone);
    const user = await this.prisma.user.findUnique({ where: { phone: normalizedPhone }, select: this.userSelect });
    const eligibleUserId = this.isEligible(user) ? user!.id : undefined;
    const { challenge, code } = await this.prisma.$transaction((tx) => this.otp.create(tx, { userId: eligibleUserId, normalizedPhone, purpose: MobileOtpPurpose.BM_STAFF_LOGIN }));
    let delivery: { status: "SENT" | "NOT_CONFIGURED" | "FAILED" };
    try {
      delivery = await this.sms.sendSms(normalizedPhone, `Your OPPO LINE OA Chat Hub verification code is ${code}. It expires in 10 minutes.`);
    } catch {
      delivery = { status: "FAILED" };
    }
    return { challengeId: challenge.id, expiresAt: challenge.expiresAt, delivery: delivery.status };
  }

  async verifyOtp(challengeId: string, code: string) {
    return this.prisma.$transaction(async (tx) => {
      const challenge = await tx.otpChallenge.findUnique({ where: { id: challengeId } });
      if (!challenge || challenge.purpose !== MobileOtpPurpose.BM_STAFF_LOGIN || !challenge.userId) throw new UnauthorizedException("Mobile login is unavailable");
      await this.otp.verify(tx, challenge, code);
      const user = await tx.user.findUnique({ where: { id: challenge.userId }, select: this.userSelect });
      if (!this.isEligible(user)) throw new UnauthorizedException("Mobile login is unavailable");
      const session = await this.auth.createSession(user!.id, SessionType.MOBILE, tx);
      return { accessToken: session.token, expiresAt: session.expiresAt };
    });
  }
}
