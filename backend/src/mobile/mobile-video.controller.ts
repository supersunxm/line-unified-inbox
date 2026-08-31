import { BadRequestException, Body, Controller, Param, Post, Req, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { AuthRequest } from "../auth/auth.guard";
import { MOBILE_VIDEO_MAX_BYTES, MobileVideoService } from "./mobile-video.service";

@Controller("mobile/conversations")
export class MobileVideoController {
  constructor(private readonly videos: MobileVideoService) {}

  @Post(":id/videos")
  @UseInterceptors(FileInterceptor("video", { limits: { fileSize: MOBILE_VIDEO_MAX_BYTES } }))
  sendVideo(
    @Req() request: AuthRequest,
    @Param("id") id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number; originalname?: string } | undefined,
    @Body("idempotencyKey") idempotencyKey: string,
  ) {
    if (!file) throw new BadRequestException("Video file is required");
    return this.videos.send(request.user!, id, file, idempotencyKey);
  }
}
