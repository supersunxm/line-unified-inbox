import { AppPlatform } from "@prisma/client";

export class AppVersionResponseDto {
  latestVersion!: string;
  buildNumber!: number;
  minimumSupportedVersion!: string;
  minimumSupportedBuildNumber!: number;
  forceUpdate!: boolean;
  apkUrl!: string;
  apkSize!: string | null;
  sha256!: string | null;
  releaseNotes!: string[];
}

export class CreateAppReleaseDto {
  platform?: AppPlatform;
  version!: string;
  buildNumber!: number;
  minimumSupportedVersion?: string;
  minimumSupportedBuildNumber?: number;
  forceUpdate?: boolean;
  apkUrl!: string;
  apkSize?: string;
  sha256?: string;
  releaseNotes?: string[];
  isActive?: boolean;
}

export class UpdateAppReleaseDto {
  forceUpdate?: boolean;
  isActive?: boolean;
  minimumSupportedVersion?: string;
  minimumSupportedBuildNumber?: number;
  apkUrl?: string;
  apkSize?: string;
  sha256?: string;
  releaseNotes?: string[];
}
