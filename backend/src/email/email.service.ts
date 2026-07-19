import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { createHash } from "node:crypto";

export type EmailLanguage = "th" | "en" | "zh";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  constructor(private readonly prisma: PrismaService) {}
  mode() { return process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "none"; }
  configured() { const mode = this.mode(); return mode === "console" ? process.env.NODE_ENV !== "production" : mode === "resend" && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM); }
  async sendAdminOtp(to: string, otp: string, language: EmailLanguage) {
    const mode = this.mode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const recipientEmailHash = createHash("sha256").update(to.trim().toLowerCase()).digest("hex");
    const bodies = {
      th: `รหัสยืนยันสำหรับสร้างผู้ดูแลระบบคือ ${otp}\nรหัสจะหมดอายุภายใน 10 นาที\nหากคุณไม่ได้ดำเนินการนี้ กรุณาเพิกเฉยต่ออีเมลฉบับนี้`,
      en: `Your administrator verification code is ${otp}.\nIt expires in 10 minutes.\nIf you did not request this, ignore this email.`,
      zh: `您的管理员验证码是 ${otp}。\n验证码将在 10 分钟后过期。\n如果这不是您的操作，请忽略此邮件。`,
    };
    try {
      if (mode === "console" && process.env.NODE_ENV !== "production") this.logger.warn(`DEVELOPMENT EMAIL MODE — first-admin OTP=${otp} destination=${this.mask(to)} expiresAt=${expiresAt.toISOString()}`);
      else if (mode === "resend" && this.configured()) {
        const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" }, body: JSON.stringify({ from: `${process.env.EMAIL_FROM_NAME ?? "OPPO LINE OA Monitor"} <${process.env.EMAIL_FROM}>`, to: [to], subject: "OPPO LINE OA Monitor verification code", text: `OPPO LINE OA Monitor\n\n${bodies[language]}\n\nNever share this code.` }) });
        if (!response.ok) throw new Error("Email provider rejected the request");
      } else throw new Error("Email provider is not configured");
      await this.prisma.emailDeliveryEvent.create({ data: { provider: mode, recipientEmailHash, purpose: "FIRST_ADMIN_REGISTRATION", success: true } });
    } catch {
      await this.prisma.emailDeliveryEvent.create({ data: { provider: mode, recipientEmailHash, purpose: "FIRST_ADMIN_REGISTRATION", success: false, sanitizedError: "Email delivery failed" } }).catch(() => undefined);
      throw new ServiceUnavailableException("Verification email could not be sent");
    }
  }
  private mask(email: string) { const [name, domain] = email.split("@"); return `${name.slice(0, 2)}***@${domain}`; }
}
