import {
  ConflictException,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { PasswordService } from "./password.service";
import {
  PILOT_ADMIN_INTERNAL_EMAIL,
  readPilotAdminBootstrapConfig,
} from "./pilot-admin-bootstrap.config";

@Injectable()
export class PilotAdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PilotAdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  async onApplicationBootstrap() {
    const config = readPilotAdminBootstrapConfig();
    if (!config) return;

    const passwordHash = await this.passwords.hash(config.password);
    const verifiedAt = new Date();
    const existing = await this.prisma.user.findUnique({
      where: { username: config.username },
      select: { id: true },
    });

    if (existing) {
      await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          displayName: config.displayName,
          passwordHash,
          role: "ADMIN",
          isActive: true,
          emailVerifiedAt: verifiedAt,
        },
      });
      this.logger.log(
        JSON.stringify({
          event: "pilot_admin_bootstrap_updated",
          username: config.username,
        }),
      );
      return;
    }

    const internalEmailOwner = await this.prisma.user.findUnique({
      where: { normalizedEmail: PILOT_ADMIN_INTERNAL_EMAIL },
      select: { id: true },
    });
    if (internalEmailOwner) {
      throw new ConflictException(
        "Pilot admin internal email is already assigned to another user; use the original PILOT_ADMIN_USERNAME",
      );
    }

    await this.prisma.user.create({
      data: {
        username: config.username,
        email: PILOT_ADMIN_INTERNAL_EMAIL,
        normalizedEmail: PILOT_ADMIN_INTERNAL_EMAIL,
        displayName: config.displayName,
        passwordHash,
        role: "ADMIN",
        isActive: true,
        emailVerifiedAt: verifiedAt,
      },
    });
    this.logger.log(
      JSON.stringify({
        event: "pilot_admin_bootstrap_created",
        username: config.username,
      }),
    );
  }
}
