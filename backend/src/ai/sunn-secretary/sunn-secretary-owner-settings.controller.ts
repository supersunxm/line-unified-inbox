import { Body, Controller, Get, Header, Patch, Post, Req, BadRequestException, ForbiddenException } from "@nestjs/common";
import type { RawBodyRequest } from "@nestjs/common";
import type { AuthRequest } from "../../auth/auth.guard";
import { assertSunnSecretaryOwner } from "./sunn-secretary-owner-settings";
import { SunnSecretaryCredentialsService } from "./sunn-secretary-credentials.service";

export function assertSecretaryMutation(request: Pick<RawBodyRequest<AuthRequest>, "headers" | "query" | "rawBody">): void {
  const origin = process.env.FRONTEND_URL ?? "http://localhost:3000";
  let expected: string;
  try { expected = new URL(origin).origin; } catch { throw new ForbiddenException("Settings request denied"); }
  if (!request.headers.cookie?.split(";").some(part => part.trim().startsWith("oppo_session=")) ||
      request.headers.origin !== expected || request.headers["x-sunn-secretary-settings"] !== "1" ||
      (request.headers["sec-fetch-site"] && !["same-origin", "same-site"].includes(String(request.headers["sec-fetch-site"])))) {
    throw new ForbiddenException("Settings request denied");
  }
  if (Object.keys(request.query).length || !/^application\/json(?:\s*;.*)?$/iu.test(String(request.headers["content-type"] ?? "")) ||
      !request.rawBody || request.rawBody.length > 8192) throw new BadRequestException("Invalid settings request");
}

@Controller("sunn-secretary/owner")
export class SunnSecretaryOwnerSettingsController {
  constructor(private readonly credentials: SunnSecretaryCredentialsService) {}

  @Get("status")
  @Header("Cache-Control", "no-store")
  status(@Req() request: AuthRequest) {
    assertSunnSecretaryOwner(request.user, process.env.SUNN_SECRETARY_OWNER_HQ_USER_ID);
    if (!request.headers.cookie?.split(";").some(part => part.trim().startsWith("oppo_session="))) throw new ForbiddenException("Web session required");
    if (Object.keys(request.query).length) throw new BadRequestException("Invalid settings request");
    return this.credentials.status();
  }

  @Patch("credentials")
  @Header("Cache-Control", "no-store")
  async save(@Req() request: RawBodyRequest<AuthRequest>, @Body() body: unknown) {
    assertSunnSecretaryOwner(request.user, process.env.SUNN_SECRETARY_OWNER_HQ_USER_ID);
    assertSecretaryMutation(request);
    await this.credentials.consumeLimit(request.user!.id, "save");
    return this.credentials.save(request.user!.id, body);
  }

  @Post("test-connection")
  @Header("Cache-Control", "no-store")
  async testConnection(@Req() request: RawBodyRequest<AuthRequest>, @Body() body: unknown) {
    assertSunnSecretaryOwner(request.user, process.env.SUNN_SECRETARY_OWNER_HQ_USER_ID);
    assertSecretaryMutation(request);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length) throw new BadRequestException("Invalid settings request");
    await this.credentials.consumeLimit(request.user!.id, "test");
    return this.credentials.testConnection(request.user!.id);
  }
}
