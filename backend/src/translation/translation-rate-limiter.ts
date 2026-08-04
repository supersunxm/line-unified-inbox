import { Injectable } from "@nestjs/common";
import { TranslationConfig } from "./translation.config";

export interface TranslationRateLimiter {
  consume(key: string): boolean;
}

export const TRANSLATION_RATE_LIMITER = Symbol("TRANSLATION_RATE_LIMITER");

type RateLimitWindow = { count: number; expiresAt: number };

@Injectable()
export class InMemoryTranslationRateLimiter implements TranslationRateLimiter {
  private readonly windows = new Map<string, RateLimitWindow>();

  constructor(private readonly config: TranslationConfig) {}

  consume(key: string): boolean {
    const now = Date.now();
    const current = this.windows.get(key);
    if (!current || current.expiresAt <= now) {
      this.windows.set(key, { count: 1, expiresAt: now + 60_000 });
      return true;
    }
    if (current.count >= this.config.rateLimitPerMinute) return false;
    current.count += 1;
    return true;
  }
}
