import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma.service";
import { PasswordService } from "./password.service";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService) {}
  private tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
  private safeUser(user: { id: string; email: string; displayName: string; role: "ADMIN" | "VIEWER"; isActive: boolean }) { return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, isActive: user.isActive }; }
  async login(email: string, password: string) {
    const identifier = email.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({ where: { OR: [{ normalizedEmail: identifier }, { username: identifier }] } });
    if (!user || !user.isActive || !user.passwordHash || !(await this.passwords.verify(password, user.passwordHash))) { this.logger.warn(JSON.stringify({ event: "login_failure", reason: "invalid_credentials" })); throw new UnauthorizedException("Invalid email or password"); }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
    await this.prisma.$transaction([this.prisma.session.create({ data: { tokenHash: this.tokenHash(token), userId: user.id, expiresAt } }), this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })]);
    this.logger.log(JSON.stringify({ event: "login_success", userId: user.id, role: user.role }));
    return { token, expiresAt, user: this.safeUser(user) };
  }
  async authenticate(token?: string) {
    if (!token) return null;
    const session = await this.prisma.session.findUnique({ where: { tokenHash: this.tokenHash(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date() || !session.user.isActive) return null;
    return this.safeUser(session.user);
  }
  async logout(token?: string) { if (token) await this.prisma.session.deleteMany({ where: { tokenHash: this.tokenHash(token) } }); }
}
