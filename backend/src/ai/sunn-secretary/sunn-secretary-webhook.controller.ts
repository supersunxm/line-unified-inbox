import { Controller, Headers, HttpCode, NotFoundException, Post, RawBodyRequest, Req, UnauthorizedException, BadRequestException } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../../auth/auth.decorators";
import { verifySunnLineSignature } from "./sunn-secretary-webhook-security";

/**
 * Isolated ingress: intentionally does NOT execute commands or send LINE replies.
 * No webhook event is persisted at this stage. Keep disabled until persistent
 * idempotency and authorized metric handlers are available in a future PR.
 */
@Public()
@Controller("sunn-secretary")
export class SunnSecretaryWebhookController {
  @Post("webhook")
  @HttpCode(200)
  receive(
    @Req() request: RawBodyRequest<Request>,
    @Headers("x-line-signature") signature?: string,
  ): { received: boolean } {
    if (process.env.SUNN_SECRETARY_WEBHOOK_ENABLED !== "true") {
      throw new NotFoundException("Secretary webhook disabled");
    }
    const secret = process.env.SUNN_SECRETARY_CHANNEL_SECRET;
    if (!secret || !verifySunnLineSignature(request.rawBody, signature, secret)) {
      throw new UnauthorizedException("Invalid LINE signature");
    }
    // LINE's raw body has already been signature checked; parse only now.
    let payload: unknown;
    try {
      payload = JSON.parse(request.rawBody!.toString("utf8"));
    } catch {
      throw new BadRequestException("Malformed LINE payload");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new BadRequestException("Invalid LINE payload");
    }
    const candidate = payload as Record<string, unknown>;
    if (!Array.isArray(candidate.events) || typeof candidate.destination !== "string" ||
      candidate.destination !== process.env.SUNN_SECRETARY_BOT_USER_ID ||
      !/^U[0-9a-f]{32}$/iu.test(candidate.destination)) {
      throw new BadRequestException("Unrecognized LINE destination or event envelope");
    }
    // Safe no-op: Never imply events were processed. LINE verification may send [].
    return { received: true };
  }
}
