import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { EmailLanguage, EmailService } from "../email/email.service";
import { PasswordService } from "./password.service";
import { AuthService } from "./auth.service";
import { assertPasswordPolicy } from "./password-policy";

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService, private readonly email: EmailService, private readonly passwords: PasswordService, private readonly auth: AuthService) {}
  private statusCache: { value: { firstAdminRequired: boolean; registrationAvailable: boolean; emailProviderConfigured: boolean; emailProviderMode: string }; expiresAt: number } | null = null;
  normalize(email: string) { return email.trim().toLowerCase(); }
  async status() {
    if (this.statusCache && this.statusCache.expiresAt > Date.now()) return this.statusCache.value;
    const activeAdmins = await this.prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    const value = { firstAdminRequired: activeAdmins === 0, registrationAvailable: activeAdmins === 0, emailProviderConfigured: this.email.configured(), emailProviderMode: this.email.mode() };
    this.statusCache = { value, expiresAt: Date.now() + 30_000 };
    return value;
  }
  private hash(id: string, code: string) { return createHash("sha256").update(`${id}:${code}`).digest(); }
  private mask(email: string) { const [name, domain] = email.split("@"); return `${name.slice(0, Math.min(2, name.length))}***@${domain}`; }
  private validatePassword(password: string) { assertPasswordPolicy(password); if (["password1234", "123456789012", "qwerty123456"].includes(password.toLowerCase())) throw new BadRequestException("Use a stronger password with at least 12 characters"); }
  async requestOtp(displayName: string, rawEmail: string, password: string, language: EmailLanguage) {
    this.validatePassword(password); if (!displayName.trim()) throw new BadRequestException("Display name is required");
    const normalizedEmail = this.normalize(rawEmail); const availability = await this.status(); if (!availability.registrationAvailable) throw new ConflictException("First administrator setup is unavailable");
    const recent = await this.prisma.adminRegistrationOtp.count({ where: { normalizedEmail, purpose: "FIRST_ADMIN_REGISTRATION", createdAt: { gte: new Date(Date.now() - 3600_000) } } });
    if (recent >= 5) throw new HttpException("Too many verification requests; try again later", HttpStatus.TOO_MANY_REQUESTS);
    if (await this.prisma.user.findUnique({ where: { normalizedEmail } })) throw new ConflictException("First administrator setup is unavailable");
    const id = randomUUID(); const code = randomInt(0, 1_000_000).toString().padStart(6, "0"); const now = Date.now();
    await this.prisma.$transaction([this.prisma.adminRegistrationOtp.updateMany({ where: { normalizedEmail, purpose: "FIRST_ADMIN_REGISTRATION", consumedAt: null }, data: { consumedAt: new Date() } }), this.prisma.adminRegistrationOtp.create({ data: { id, email: rawEmail.trim(), normalizedEmail, codeHash: this.hash(id, code).toString("base64"), purpose: "FIRST_ADMIN_REGISTRATION", expiresAt: new Date(now + 600_000), resendAvailableAt: new Date(now + 60_000) } })]);
    try { await this.email.sendAdminOtp(rawEmail.trim(), code, language); } catch (error) { await this.prisma.adminRegistrationOtp.update({ where: { id }, data: { consumedAt: new Date() } }); throw error; }
    return { challengeId: id, maskedEmail: this.mask(normalizedEmail), expiresInSeconds: 600, resendAfterSeconds: 60 };
  }
  async verify(challengeId: string, rawEmail: string, displayName: string, password: string, otp: string) {
    this.validatePassword(password); const normalizedEmail = this.normalize(rawEmail); const challenge = await this.prisma.adminRegistrationOtp.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.normalizedEmail !== normalizedEmail || challenge.consumedAt || challenge.expiresAt <= new Date()) throw new UnauthorizedException("Verification code is invalid or expired");
    if (challenge.attempts >= challenge.maxAttempts) throw new HttpException("Verification challenge is locked", HttpStatus.TOO_MANY_REQUESTS);
    const received = this.hash(challenge.id, otp); const expected = Buffer.from(challenge.codeHash, "base64");
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) { await this.prisma.adminRegistrationOtp.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } }); throw new UnauthorizedException("Verification code is invalid or expired"); }
    const passwordHash = await this.passwords.hash(password); const emailVerifiedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(72819461)`;
      if (await tx.user.count({ where: { role: "ADMIN", isActive: true } })) throw new ConflictException("First administrator setup is unavailable");
      await tx.user.create({ data: { email: normalizedEmail, normalizedEmail, displayName: displayName.trim(), passwordHash, role: "ADMIN", isActive: true, emailVerifiedAt } });
      await tx.adminRegistrationOtp.updateMany({ where: { normalizedEmail, purpose: "FIRST_ADMIN_REGISTRATION", consumedAt: null }, data: { consumedAt: emailVerifiedAt } });
    });
    this.statusCache = null;
    return this.auth.login(normalizedEmail, password);
  }
  async resend(challengeId: string, language: EmailLanguage) {
    const challenge = await this.prisma.adminRegistrationOtp.findUnique({ where: { id: challengeId } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) throw new BadRequestException("Verification challenge is unavailable");
    if (challenge.resendAvailableAt > new Date()) throw new HttpException("Please wait before requesting another code", HttpStatus.TOO_MANY_REQUESTS);
    return this.requestOtp("Administrator", challenge.email, "resend-validation-placeholder", language);
  }
}
