import {
  BadRequestException,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import type { Request } from "express";
import { Public } from "../auth/auth.decorators";
import { Review15VisionService } from "./review15-vision.service";

const MAX_IMAGES = 3;
const MAX_FILE_SIZE = 6 * 1024 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 12;

type RateBucket = {
  count: number;
  resetAt: number;
};

@Controller("review15")
export class Review15VisionController {
  private readonly rateBuckets = new Map<string, RateBucket>();

  constructor(private readonly vision: Review15VisionService) {}

  @Public()
  @Post("scan")
  @UseInterceptors(
    FilesInterceptor("images", MAX_IMAGES, {
      limits: {
        files: MAX_IMAGES,
        fileSize: MAX_FILE_SIZE,
      },
    }),
  )
  async scan(
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Req() request: Request,
  ) {
    this.consumeRateLimit(request);

    if (!files?.length) {
      throw new BadRequestException("At least one review image is required");
    }

    for (const file of files) {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
        throw new BadRequestException("Only JPG, PNG, and WEBP images are supported");
      }
      if (!file.buffer?.length) {
        throw new BadRequestException("Review image is empty");
      }
    }

    return this.vision.scan(files.map((file) => file.buffer));
  }

  private consumeRateLimit(request: Request): void {
    const forwarded = request.headers["x-forwarded-for"];
    const forwardedValue = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const key =
      forwardedValue?.split(",")[0]?.trim() ||
      request.ip ||
      request.socket.remoteAddress ||
      "unknown";

    const now = Date.now();
    const existing = this.rateBuckets.get(key);

    if (!existing || now >= existing.resetAt) {
      this.rateBuckets.set(key, {
        count: 1,
        resetAt: now + WINDOW_MS,
      });
      return;
    }

    if (existing.count >= MAX_REQUESTS_PER_WINDOW) {
      throw new HttpException(
        "Too many review image scans. Please try again later.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    existing.count += 1;
  }
}
