import { Controller, Headers, HttpCode, NotFoundException, Post, RawBodyRequest, Req, UnauthorizedException, BadRequestException, PayloadTooLargeException, ServiceUnavailableException } from "@nestjs/common";
import type { Request } from "express";
import { Public } from "../../auth/auth.decorators";
import { verifySunnLineSignature } from "./sunn-secretary-webhook-security";
import { SunnSecretaryCredentialsService } from "./sunn-secretary-credentials.service";
import { SunnSecretaryInboundService } from "./sunn-secretary-inbound.service";

/** Isolated ingress. Acceptance never means execution or delivery; no outbound capability. */
@Public()
@Controller("sunn-secretary")
export class SunnSecretaryWebhookController {
  constructor(private readonly credentials: SunnSecretaryCredentialsService, private readonly inbound: SunnSecretaryInboundService) {}

  @Post("webhook")
  @HttpCode(200)
  async receive(@Req() request: RawBodyRequest<Request>, @Headers("x-line-signature") signature?: string): Promise<{ received: boolean }> {
    if (process.env.SUNN_SECRETARY_WEBHOOK_ENABLED !== "true") throw new NotFoundException("Secretary webhook disabled");
    if (request.rawBody && request.rawBody.length > 128 * 1024) throw new PayloadTooLargeException("LINE payload too large");
    let identity: { botUserId: string; channelSecret: string };
    try { identity = await this.credentials.inboundIdentity(); }
    catch { throw new ServiceUnavailableException("Secretary identity unavailable"); }
    const { botUserId, channelSecret } = identity;
    if (!verifySunnLineSignature(request.rawBody, signature, channelSecret)) throw new UnauthorizedException("Invalid LINE signature");
    let payload: unknown;
    try { payload = JSON.parse(request.rawBody!.toString("utf8")); }
    catch { throw new BadRequestException("Malformed LINE payload"); }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new BadRequestException("Invalid LINE payload");
    const candidate = payload as Record<string, unknown>;
    if (!Array.isArray(candidate.events) || candidate.events.length > 20 || candidate.destination !== botUserId ||
        !/^U[0-9a-f]{32}$/iu.test(botUserId)) throw new BadRequestException("Unrecognized LINE destination or event envelope");
    try { await this.inbound.accept(botUserId, candidate.events); }
    catch { throw new ServiceUnavailableException("Secretary event persistence unavailable"); }
    return { received: true };
  }
}
