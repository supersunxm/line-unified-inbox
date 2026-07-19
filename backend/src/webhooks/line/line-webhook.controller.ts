import { BadRequestException, Body, Controller, GoneException, Headers, HttpCode, Logger, NotFoundException, Param, Post, RawBodyRequest, Req, UnauthorizedException } from "@nestjs/common";
import { Request } from "express";
import { LineWebhookConfig } from "./line-webhook.config";
import { LineWebhookService } from "./line-webhook.service";
import { LineSignatureService } from "./line-signature.service";
import { isLineWebhookBody, LineWebhookBody } from "./line-webhook.types";
import { Public } from "../../auth/auth.decorators";

@Controller("webhook")
@Public()
export class LineWebhookController {
  private readonly logger = new Logger(LineWebhookController.name);
  private readonly diagnosticsEnabled = process.env.NODE_ENV !== "production";
  constructor(private readonly signatures: LineSignatureService, private readonly webhooks: LineWebhookService, private readonly config: LineWebhookConfig) {}

  private diagnostic(message: string, details: Record<string, unknown>) {
    if (this.diagnosticsEnabled) this.logger.log(`${message} ${JSON.stringify(details)}`);
  }

  @Post(":webhookKey")
  @HttpCode(200)
  async receiveForOa(@Param("webhookKey") webhookKey: string, @Req() request: RawBodyRequest<Request>, @Headers("x-line-signature") signature: string | undefined, @Body() body: unknown) {
    return this.handle(request, signature, body, webhookKey);
  }

  private async handle(request: RawBodyRequest<Request>, signature: string | undefined, body: unknown, webhookKey: string) {
    const rawBodyLength = request.rawBody?.length ?? 0;
    const credential = await this.webhooks.resolveSignatureCredentialByWebhookKey(webhookKey);
    const signatureValid = Boolean(request.rawBody && signature && credential.secret && this.signatures.verify(request.rawBody, signature, credential.secret));
    const diagnostics = (httpStatus: number, parsedBody?: LineWebhookBody) => this.diagnostic("LINE webhook diagnostic", {
      routeReached: true,
      webhookKeyFound: Boolean(credential.oa),
      oaActive: credential.oa?.isActive ?? null,
      oaArchived: credential.oa?.isArchived ?? null,
      lineOaId: credential.oa?.id ?? null,
      lineOaName: credential.oa?.name ?? null,
      encryptedChannelSecretExists: credential.channelSecretStored ?? Boolean(credential.secret),
      channelSecretDecryptionSucceeds: credential.channelSecretDecryptable ?? Boolean(credential.secret),
      lineSignatureExists: Boolean(signature), rawBodyExists: Boolean(request.rawBody), rawBodyByteLength: rawBodyLength,
      parsedDestination: parsedBody?.destination ?? null, parsedEventsCount: parsedBody?.events.length ?? null,
      signatureValid, finalHttpStatus: httpStatus,
    });
    if (!this.config.enabled) { diagnostics(404); throw new NotFoundException("LINE webhook is disabled"); }
    if (!credential.oa) { diagnostics(404); throw new NotFoundException("Webhook not found"); }
    if (credential.oa.isArchived) { diagnostics(410); throw new GoneException("Webhook belongs to an archived LINE Official Account"); }
    if (!credential.oa.isActive) { diagnostics(410); throw new GoneException("Webhook belongs to a disabled LINE Official Account"); }
    if (!signature) { diagnostics(401); throw new UnauthorizedException("Invalid LINE webhook signature"); }
    if (!request.rawBody || request.rawBody.length === 0) { diagnostics(400); throw new BadRequestException("Raw request body is unavailable"); }
    if (!signatureValid) { diagnostics(401); throw new UnauthorizedException("Invalid LINE webhook signature"); }
    const parsed = isLineWebhookBody(body) ? body : undefined;
    if (!parsed) { diagnostics(400); throw new BadRequestException("Invalid LINE webhook body"); }
    try {
      const result = await this.webhooks.accept(parsed, credential.oa.id);
      diagnostics(200, parsed);
      return result;
    } catch (error) {
      diagnostics(500, parsed);
      throw error;
    }
  }
}
