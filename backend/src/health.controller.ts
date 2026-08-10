import { Controller, Get } from "@nestjs/common";
import { Public } from "./auth/auth.decorators";
import { PrismaService } from "./prisma.service";
import { MediaStorageService } from "./media/media-storage";
import { Roles } from "./auth/auth.decorators";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly media: MediaStorageService) {}

  @Public()
  @Get()
  async health() {
    let dbConnected = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbConnected = true;
    } catch {
      dbConnected = false;
    }

    return {
      status: dbConnected ? "healthy" : "degraded",
      database: dbConnected,
      timestamp: new Date().toISOString(),
      version: "1.0.0",
    };
  }

  @Public()
  @Get("storage")
  async storage() { return { ...(await this.media.health()), debug: this.media.diagnostics() }; }

  @Roles("ADMIN")
  @Get("storage/write-test")
  storageWriteTest() { return this.media.writeTest(); }

  @Public()
  @Get("readiness")
  async readiness() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ready" };
  }
}
