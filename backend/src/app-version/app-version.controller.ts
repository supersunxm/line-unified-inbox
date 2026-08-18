import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { AppPlatform } from "@prisma/client";
import { Public, Roles } from "../auth/auth.decorators";
import { AppVersionService } from "./app-version.service";
import { CreateAppReleaseDto, UpdateAppReleaseDto } from "./app-version.dto";

@Controller()
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  @Public()
  @Get("app/version/android")
  getAndroidVersion() {
    return this.appVersionService.getLatestVersion(AppPlatform.ANDROID);
  }

  @Public()
  @Get("app/version/:platform")
  getVersion(@Param("platform") platform: string) {
    const p = platform.toUpperCase() === "IOS" ? AppPlatform.IOS : AppPlatform.ANDROID;
    return this.appVersionService.getLatestVersion(p);
  }

  @Public()
  @Post("app/version/track-download")
  trackDownload(
    @Query("platform") platform?: string,
    @Query("buildNumber") buildNumber?: string,
  ) {
    const p = platform?.toUpperCase() === "IOS" ? AppPlatform.IOS : AppPlatform.ANDROID;
    const b = buildNumber ? parseInt(buildNumber, 10) : undefined;
    return this.appVersionService.trackDownload(p, isNaN(b as number) ? undefined : b);
  }

  @Roles("ADMIN")
  @Get("app/releases")
  listReleases(@Query("platform") platform?: string) {
    const p = platform
      ? platform.toUpperCase() === "IOS"
        ? AppPlatform.IOS
        : AppPlatform.ANDROID
      : undefined;
    return this.appVersionService.listReleases(p);
  }

  @Roles("ADMIN")
  @Post("app/releases")
  createRelease(@Body() dto: CreateAppReleaseDto) {
    return this.appVersionService.createRelease(dto);
  }

  @Roles("ADMIN")
  @Patch("app/releases/:id")
  updateRelease(@Param("id") id: string, @Body() dto: UpdateAppReleaseDto) {
    return this.appVersionService.updateRelease(id, dto);
  }
}
