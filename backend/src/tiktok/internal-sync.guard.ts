import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "crypto";

function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Dedicated guard protecting internal service-to-service TikTok account synchronization.
 * Requires and validates the X-Internal-TikTok-Secret header against TIKTOK_INTERNAL_SYNC_SECRET using timingSafeEqual.
 * Fails closed if the environment variable is missing or if the provided secret does not match.
 */
@Injectable()
export class InternalTikTokSyncGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const expectedSecret = process.env.TIKTOK_INTERNAL_SYNC_SECRET?.trim();

    // Fail closed if backend environment does not have internal secret configured
    if (!expectedSecret) {
      throw new UnauthorizedException("Internal service synchronization authentication is not configured");
    }

    const rawHeader =
      request.headers["x-internal-tiktok-secret"] ||
      request.headers["X-Internal-TikTok-Secret"];

    const providedSecret = (Array.isArray(rawHeader) ? rawHeader[0] : rawHeader)?.trim();

    if (!providedSecret) {
      throw new UnauthorizedException("Missing internal service secret");
    }

    if (!timingSafeStringEqual(providedSecret, expectedSecret)) {
      throw new UnauthorizedException("Invalid internal service secret");
    }

    return true;
  }
}
