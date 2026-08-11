import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { MembershipStatus, MobileOtpPurpose, SessionType, UserStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { AuthService } from "./auth.service";
import { OtpChallengeService } from "./otp-challenge.service";
import { normalizeThaiMobilePhone } from "./phone-normalization";
import { SMS_PROVIDER, SmsProvider } from "./sms-provider";

@Injectable()
export class MobileAuthService {
  constructor(private readonly prisma: PrismaService, private readonly otp: OtpChallengeService, private readonly auth: AuthService, @Inject(SMS_PROVIDER) private readonly sms: SmsProvider) {}

  async sendOtp(rawPhone: string) {
    const normalizedPhone = normalizeThaiMobilePhone(rawPhone);
    const user = await this.prisma.user.findUnique({
      where: { phone: normalizedPhone },
      select: {
        id: true,
        isActive: true,
        status: true,
        memberships: { where: { status: MembershipStatus.ACTIVE, store: { isActive: true, archivedAt: null } }, select: { id: true } },
      },
    });
    const eligibleUserId = user?.isActive && user.status === UserStatus.ACTIVE && user.memberships.length > 0 ? user.id : undefined;
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
      const user = await tx.user.findUnique({
        where: { id: challenge.userId },
        select: { id: true, isActive: true, status: true, memberships: { where: { status: MembershipStatus.ACTIVE, store: { isActive: true, archivedAt: null } }, select: { id: true } } },
      });
      if (!user || !user.isActive || user.status !== UserStatus.ACTIVE || user.memberships.length === 0) throw new UnauthorizedException("Mobile login is unavailable");
      const session = await this.auth.createSession(user.id, SessionType.MOBILE, tx);
      return { accessToken: session.token, expiresAt: session.expiresAt };
    });
  }
}
