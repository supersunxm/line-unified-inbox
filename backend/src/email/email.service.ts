import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { createHash } from "node:crypto";
import { emailFromAddress } from "./email.config";
import { EMAIL_PROVIDER, type EmailMessage, type EmailProvider } from "./email-provider";
import { accountApprovedEmail, type ApprovedAccountEmailInput } from "./templates/account-approved.template";

export type EmailLanguage = "th" | "en" | "zh";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}
  mode() { return process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "none"; }
  configured() { const mode = this.mode(); return mode === "console" ? process.env.NODE_ENV !== "production" : mode === "resend" && Boolean(process.env.RESEND_API_KEY?.trim() && emailFromAddress()); }
  async sendAdminOtp(to: string, otp: string, language: EmailLanguage) {
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const bodies = {
      th: `รหัสยืนยันสำหรับสร้างผู้ดูแลระบบคือ ${otp}\nรหัสจะหมดอายุภายใน 10 นาที\nหากคุณไม่ได้ดำเนินการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้`,
      en: `Your administrator verification code is ${otp}.\nIt expires in 10 minutes.\nIf you did not request this, ignore this email.`,
      zh: `您的管理员验证码是 ${otp}。\n验证码将在 10 分钟后过期。\n如果这不是您的操作，请忽略此邮件。`,
    };
    if (this.mode() === "console" && process.env.NODE_ENV !== "production") {
      this.logger.warn(`DEVELOPMENT EMAIL MODE — first-admin OTP=${otp} destination=${this.mask(to)} expiresAt=${expiresAt.toISOString()}`);
      await this.recordDelivery(to, "FIRST_ADMIN_REGISTRATION", true);
      return;
    }
    await this.deliver({ to: to.trim(), subject: "OPPO LINE OA Monitor verification code", text: `OPPO LINE OA Monitor\n\n${bodies[language]}\n\nNever share this code.` }, "FIRST_ADMIN_REGISTRATION", "Verification email could not be sent");
  }

  async sendAccountApproved(input: ApprovedAccountEmailInput) {
    await this.deliver(accountApprovedEmail(input), "ACCOUNT_APPROVED", "Approval notification email could not be sent");
  }

  private async deliver(message: EmailMessage, purpose: string, failureMessage: string) {
    try {
      if (this.mode() !== "resend" || !this.configured()) throw new Error("Email provider is not configured");
      await this.provider.send(message);
      await this.recordDelivery(message.to, purpose, true);
    } catch {
      await this.recordDelivery(message.to, purpose, false);
      this.logger.warn(JSON.stringify({ event: "email_delivery_failed", provider: this.mode(), purpose, recipientEmailHash: this.recipientEmailHash(message.to), sanitizedError: "Email delivery failed" }));
      throw new ServiceUnavailableException(failureMessage);
    }
  }

  private async recordDelivery(to: string, purpose: string, success: boolean) {
    await this.prisma.emailDeliveryEvent.create({ data: { provider: this.mode(), recipientEmailHash: this.recipientEmailHash(to), purpose, success, ...(success ? {} : { sanitizedError: "Email delivery failed" }) } }).catch(() => undefined);
  }

  private recipientEmailHash(email: string) { return createHash("sha256").update(email.trim().toLowerCase()).digest("hex"); }
  private mask(email: string) { const [name, domain] = email.split("@"); return `${name.slice(0, 2)}***@${domain}`; }
}
