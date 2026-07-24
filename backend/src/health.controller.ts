import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/auth.decorators";
import { PrismaService } from "./prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Public()
  @Get()
  health() { return { status: "ok", timestamp: new Date().toISOString() }; }
  @Public()
  @Get("readiness")
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ready" };
  }
}
