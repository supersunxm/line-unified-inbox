import { Injectable, NotFoundException } from "@nestjs/common";
import { AppPlatform } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { AppVersionResponseDto, CreateAppReleaseDto, UpdateAppReleaseDto } from "./app-version.dto";

const DEFAULT_ANDROID_VERSION: AppVersionResponseDto = {
  latestVersion: "1.0.8",
  buildNumber: 9,
  minimumSupportedVersion: "1.0.3",
  minimumSupportedBuildNumber: 4,
  forceUpdate: false,
  apkUrl: "https://lineoppo.click/downloads/oppo-line-oa-chat-v1.0.8-production.apk?sha=532fd6b7a706fc2c589aedab1d8e5522d2a66827cba220f75a0d8c62517b87e8",
  apkSize: "56.9 MB",
  sha256: "532fd6b7a706fc2c589aedab1d8e5522d2a66827cba220f75a0d8c62517b87e8",
  releaseNotes: [
    "Confirmed product selections are saved immediately",
    "Fixed product tags disappearing after closing Customer Sales Info",
    "Rehydrates saved product tagging from the backend response",
    "Prevents closing or changing product selection while a save is in progress",
    "Improved reliability of customer sales tagging persistence",
  ],
};

@Injectable()
export class AppVersionService {
  constructor(private readonly prisma: PrismaService) {}

  async getLatestVersion(platform: AppPlatform = AppPlatform.ANDROID): Promise<AppVersionResponseDto> {
    try {
      const release = await this.prisma.appRelease.findFirst({
        where: {
          platform,
          isActive: true,
        },
        orderBy: {
          buildNumber: "desc",
        },
      });

      if (!release) {
        return DEFAULT_ANDROID_VERSION;
      }

      return {
        latestVersion: release.version,
        buildNumber: release.buildNumber,
        minimumSupportedVersion: release.minimumSupportedVersion,
        minimumSupportedBuildNumber: release.minimumSupportedBuildNumber,
        forceUpdate: release.forceUpdate,
        apkUrl: release.apkUrl,
        apkSize: release.apkSize,
        sha256: release.sha256,
        releaseNotes: release.releaseNotes,
      };
    } catch {
      return DEFAULT_ANDROID_VERSION;
    }
  }

  async trackDownload(platform: AppPlatform = AppPlatform.ANDROID, buildNumber?: number) {
    try {
      const release = await this.prisma.appRelease.findFirst({
        where: buildNumber
          ? { platform, buildNumber }
          : { platform, isActive: true },
        orderBy: { buildNumber: "desc" },
      });

      if (release) {
        await this.prisma.appRelease.update({
          where: { id: release.id },
          data: { downloadCount: { increment: 1 } },
        });
      }
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  async listReleases(platform?: AppPlatform) {
    return this.prisma.appRelease.findMany({
      where: platform ? { platform } : undefined,
      orderBy: { buildNumber: "desc" },
    });
  }

  async createRelease(dto: CreateAppReleaseDto) {
    const platform = dto.platform ?? AppPlatform.ANDROID;
    return this.prisma.appRelease.upsert({
      where: {
        platform_buildNumber: {
          platform,
          buildNumber: dto.buildNumber,
        },
      },
      create: {
        platform,
        version: dto.version,
        buildNumber: dto.buildNumber,
        minimumSupportedVersion: dto.minimumSupportedVersion ?? "1.0.3",
        minimumSupportedBuildNumber: dto.minimumSupportedBuildNumber ?? 4,
        forceUpdate: dto.forceUpdate ?? false,
        apkUrl: dto.apkUrl,
        apkSize: dto.apkSize,
        sha256: dto.sha256,
        releaseNotes: dto.releaseNotes ?? [],
        isActive: dto.isActive ?? true,
      },
      update: {
        version: dto.version,
        minimumSupportedVersion: dto.minimumSupportedVersion,
        minimumSupportedBuildNumber: dto.minimumSupportedBuildNumber,
        forceUpdate: dto.forceUpdate,
        apkUrl: dto.apkUrl,
        apkSize: dto.apkSize,
        sha256: dto.sha256,
        releaseNotes: dto.releaseNotes,
        isActive: dto.isActive,
      },
    });
  }

  async updateRelease(id: string, dto: UpdateAppReleaseDto) {
    const release = await this.prisma.appRelease.findUnique({ where: { id } });
    if (!release) throw new NotFoundException("Release not found");

    return this.prisma.appRelease.update({
      where: { id },
      data: {
        forceUpdate: dto.forceUpdate,
        isActive: dto.isActive,
        minimumSupportedVersion: dto.minimumSupportedVersion,
        minimumSupportedBuildNumber: dto.minimumSupportedBuildNumber,
        apkUrl: dto.apkUrl,
        apkSize: dto.apkSize,
        sha256: dto.sha256,
        releaseNotes: dto.releaseNotes,
      },
    });
  }
}
