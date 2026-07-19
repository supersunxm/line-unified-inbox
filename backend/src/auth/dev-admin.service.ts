import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { PasswordService } from "./password.service";

@Injectable()
export class DevAdminService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DevAdminService.name);
  constructor(private readonly prisma: PrismaService, private readonly passwords: PasswordService) {}
  async onApplicationBootstrap() {
    const enabled = process.env.DEV_ADMIN_ENABLED === "true";
    if (process.env.NODE_ENV === "production") {
      if (enabled) throw new Error("DEV_ADMIN_ENABLED must never be true in production");
      return;
    }
    if (!enabled) return;
    const username = process.env.DEV_ADMIN_USERNAME?.trim().toLowerCase();
    const password = process.env.DEV_ADMIN_PASSWORD;
    if (!username || !password) throw new Error("DEV_ADMIN_USERNAME and DEV_ADMIN_PASSWORD are required when development admin is enabled");
    const email = "admin@local.test"; const passwordHash = await this.passwords.hash(password);
    const existing = await this.prisma.user.findFirst({ where: { OR: [{ username }, { normalizedEmail: email }] }, select: { id: true } });
    const data = { username, email, normalizedEmail: email, displayName: "Local Development Admin", passwordHash, role: "ADMIN" as const, isActive: true, emailVerifiedAt: new Date() };
    if (existing) await this.prisma.user.update({ where: { id: existing.id }, data }); else await this.prisma.user.create({ data });
    this.logger.warn(JSON.stringify({ event: "development_admin_ready", username, environment: "development" }));
  }
}
