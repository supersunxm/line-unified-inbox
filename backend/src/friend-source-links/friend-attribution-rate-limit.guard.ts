import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Request } from "express";
import { getFriendAttributionHashSecret, hashLineUserId } from "./friend-attribution.config";

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

@Injectable()
export class FriendAttributionRateLimitGuard implements CanActivate {
  private readonly store = new Map<string, RateLimitRecord>();
  private readonly maxRequests = 60; // 60 requests
  private readonly windowMs = 60 * 1000; // per 1 minute

  constructor() {
    // Opportunistic cleanup of expired records every 60 seconds
    setInterval(() => this.cleanup(), this.windowMs).unref?.();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientKey = this.deriveClientKey(request);

    const now = Date.now();
    const record = this.store.get(clientKey);

    if (!record || record.resetAt <= now) {
      this.store.set(clientKey, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (record.count >= this.maxRequests) {
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many friend attribution requests. Please try again later.",
          error: "Too Many Requests",
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    record.count += 1;
    return true;
  }

  private deriveClientKey(req: Request): string {
    const forwarded = req.headers["x-forwarded-for"];
    const rawIp = typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : (req.headers["x-real-ip"] as string) || req.socket.remoteAddress || "127.0.0.1";

    const secret = getFriendAttributionHashSecret();
    const ipHash = hashLineUserId(rawIp, secret);
    return `${ipHash}:${req.path}`;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetAt <= now) {
        this.store.delete(key);
      }
    }
  }
}
