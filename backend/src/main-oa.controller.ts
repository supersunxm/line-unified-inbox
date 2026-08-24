import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { IsBoolean, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { randomBytes } from "node:crypto";
import type { AuthRequest } from "./auth/auth.guard";
import { MainOaAccessService } from "./auth/main-oa-access.service";
import { ConversationsService } from "./conversations.service";
import { CredentialEncryptionService } from "./credentials/credential-encryption.service";
import { ConversationQueryDto, SendConversationMessageDto } from "./dto";
import { PrismaService } from "./prisma.service";

class CreateMainOaDto {
  @IsString() @IsNotEmpty() name!: string;
  @IsOptional() @IsString() basicId?: string;
  @IsOptional() @IsString() channelId?: string;
  @IsOptional() @IsString() destinationId?: string;
  @IsString() @IsNotEmpty() channelSecret!: string;
  @IsString() @IsNotEmpty() channelAccessToken!: string;
  @IsOptional() @IsBoolean() isActive = true;
}

@Controller("main-oa")
export class MainOaController {
  constructor(private readonly prisma: PrismaService, private readonly conversations: ConversationsService, private readonly access: MainOaAccessService, private readonly encryption: CredentialEncryptionService) {}
  @Get("accounts") async accounts(@Req() req: AuthRequest) { this.access.assertAccess(req.user!); return this.prisma.lineOfficialAccount.findMany({ where: { accountType: "HEAD_OFFICE", archivedAt: null }, select: { id: true, name: true, basicId: true, channelId: true, destinationId: true, connectionStatus: true, isActive: true, lastWebhookReceivedAt: true, _count: { select: { conversations: true } } }, orderBy: { name: "asc" } }); }
  @Post("accounts") async create(@Body() dto: CreateMainOaDto, @Req() req: AuthRequest) { this.access.assertManage(req.user!); return this.prisma.lineOfficialAccount.create({ data: { accountType: "HEAD_OFFICE", storeId: null, webhookKey: randomBytes(24).toString("base64url"), name: dto.name.trim(), basicId: dto.basicId?.trim() || null, channelId: dto.channelId?.trim() || null, destinationId: dto.destinationId?.trim() || null, encryptedChannelSecret: this.encryption.encrypt(dto.channelSecret.trim()), encryptedChannelAccessToken: this.encryption.encrypt(dto.channelAccessToken.trim()), isActive: dto.isActive, connectionStatus: dto.isActive ? "READY" : "DISABLED" }, select: { id: true, name: true, accountType: true, isActive: true } }); }
  @Get("conversations") async list(@Query() query: ConversationQueryDto, @Req() req: AuthRequest) { this.access.assertAccess(req.user!); return this.conversations.list(query, null, "HEAD_OFFICE"); }
  @Get("conversations/:id") async get(@Param("id") id: string, @Req() req: AuthRequest) { await this.access.assertConversationAccess(req.user!, id); return this.conversations.get(id); }
  @Get("conversations/:id/messages") async messages(@Param("id") id: string, @Query("page") page = "1", @Query("pageSize") pageSize = "30", @Req() req: AuthRequest) { await this.access.assertConversationAccess(req.user!, id); return this.conversations.messages(id, Number(page), Number(pageSize)); }
  @Post("conversations/:id/messages") async send(@Param("id") id: string, @Body() dto: SendConversationMessageDto, @Req() req: AuthRequest) { this.access.assertManage(req.user!); await this.access.assertConversationAccess(req.user!, id); return this.conversations.sendMessage(id, dto, req.user!); }
  @Patch("conversations/:id/bm-reply-status") async status(@Param("id") id: string, @Body("status") status: "NOT_REPLIED" | "NOTIFIED_BM" | "REPLIED", @Req() req: AuthRequest) { this.access.assertManage(req.user!); await this.access.assertConversationAccess(req.user!, id); return this.conversations.updateBmReplyStatus(id, status); }
}
