import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { randomBytes } from "node:crypto";
import type { AuthRequest } from "./auth/auth.guard";
import { MainOaAccessService } from "./auth/main-oa-access.service";
import { ConversationsService } from "./conversations.service";
import { CredentialEncryptionService } from "./credentials/credential-encryption.service";
import { LineStatelessTokenService } from "./credentials/line-stateless-token.service";
import { ConversationQueryDto, SendConversationMessageDto } from "./dto";
import { PrismaService } from "./prisma.service";

class CreateMainOaDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() basicId?: string;
  @IsString() @IsNotEmpty() channelId!: string;
  @IsOptional() @IsString() destinationId?: string;
  @IsString() @IsNotEmpty() channelSecret!: string;
  @IsOptional() @IsBoolean() isActive = true;
}

@Controller("main-oa")
export class MainOaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly conversations: ConversationsService,
    private readonly access: MainOaAccessService,
    private readonly encryption: CredentialEncryptionService,
    private readonly statelessTokens: LineStatelessTokenService,
  ) {}

  private webhookUrl(webhookKey: string) {
    const raw = process.env.PUBLIC_WEBHOOK_BASE_URL?.trim();
    if (!raw) return null;
    try {
      const url = new URL(raw);
      if (process.env.NODE_ENV !== "test" && url.protocol !== "https:") return null;
      if (url.username || url.password) return null;
      return `${raw.replace(/\/+$/, "")}/webhook/${webhookKey}`;
    } catch {
      return null;
    }
  }

  @Get("accounts")
  async accounts(@Req() req: AuthRequest) {
    this.access.assertAccess(req.user!);
    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: { accountType: "HEAD_OFFICE", archivedAt: null },
      select: {
        id: true,
        webhookKey: true,
        name: true,
        basicId: true,
        channelId: true,
        destinationId: true,
        connectionStatus: true,
        isActive: true,
        lastWebhookReceivedAt: true,
        lastConnectionTestAt: true,
        lastConnectionError: true,
        _count: { select: { conversations: true } },
      },
      orderBy: { name: "asc" },
    });
    return accounts.map(({ webhookKey, ...account }) => ({
      ...account,
      webhookUrl: this.webhookUrl(webhookKey),
      credentialMode: "STATELESS" as const,
      tokenManagedAutomatically: true,
    }));
  }

  @Post("accounts")
  async create(@Body() dto: CreateMainOaDto, @Req() req: AuthRequest) {
    this.access.assertManage(req.user!);
    const channelId = dto.channelId.trim();
    const channelSecret = dto.channelSecret.trim();
    const verified = await this.statelessTokens.issueAndInspect(channelId, channelSecret);
    const webhookKey = randomBytes(24).toString("base64url");
    const webhookUrl = this.webhookUrl(webhookKey);
    const isActive = dto.isActive ?? true;

    const account = await this.prisma.lineOfficialAccount.create({
      data: {
        accountType: "HEAD_OFFICE",
        storeId: null,
        webhookKey,
        name: dto.name.trim(),
        basicId: dto.basicId?.trim() || verified.botInfo.basicId?.trim() || null,
        channelId,
        destinationId: dto.destinationId?.trim() || verified.botInfo.userId?.trim() || null,
        encryptedChannelSecret: this.encryption.encrypt(channelSecret),
        encryptedChannelAccessToken: this.encryption.encrypt(verified.accessToken),
        isActive,
        connectionStatus: isActive ? (webhookUrl ? "READY" : "NOT_CONFIGURED") : "DISABLED",
        lastConnectionTestAt: new Date(),
        lastConnectionError: null,
      },
      select: {
        id: true,
        name: true,
        basicId: true,
        channelId: true,
        destinationId: true,
        accountType: true,
        connectionStatus: true,
        isActive: true,
      },
    });

    return {
      ...account,
      webhookUrl,
      credentialMode: "STATELESS" as const,
      tokenManagedAutomatically: true,
      tokenExpiresInSeconds: verified.expiresIn,
    };
  }

  @Get("conversations")
  async list(@Query() query: ConversationQueryDto, @Req() req: AuthRequest) {
    this.access.assertAccess(req.user!);
    return this.conversations.list(query, null, "HEAD_OFFICE");
  }

  @Get("conversations/:id")
  async get(@Param("id") id: string, @Req() req: AuthRequest) {
    await this.access.assertConversationAccess(req.user!, id);
    return this.conversations.get(id);
  }

  @Get("conversations/:id/messages")
  async messages(@Param("id") id: string, @Query("page") page = "1", @Query("pageSize") pageSize = "30", @Req() req: AuthRequest) {
    await this.access.assertConversationAccess(req.user!, id);
    return this.conversations.messages(id, Number(page), Number(pageSize));
  }

  @Post("conversations/:id/messages")
  async send(@Param("id") id: string, @Body() dto: SendConversationMessageDto, @Req() req: AuthRequest) {
    this.access.assertManage(req.user!);
    await this.access.assertConversationAccess(req.user!, id);
    return this.conversations.sendMessage(id, dto, req.user!);
  }

  @Patch("conversations/:id/bm-reply-status")
  async status(@Param("id") id: string, @Body("status") status: "NOT_REPLIED" | "NOTIFIED_BM" | "REPLIED", @Req() req: AuthRequest) {
    this.access.assertManage(req.user!);
    await this.access.assertConversationAccess(req.user!, id);
    return this.conversations.updateBmReplyStatus(id, status);
  }
}
