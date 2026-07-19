import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { CreateLineOfficialAccountDto, UpdateLineOfficialAccountDto, UpdateLineOaStatusDto } from "./line-official-account.dto";
import { LineOfficialAccountsService } from "./line-official-accounts.service";
import { Roles } from "../auth/auth.decorators";

@Controller("line-official-accounts")
export class LineOfficialAccountsController {
  constructor(private readonly service: LineOfficialAccountsService) {}
  @Get() list(@Query("showArchived") showArchived?: string) { return this.service.list(showArchived === "true"); }
  @Get(":id") get(@Param("id") id: string) { return this.service.get(id); }
  @Get(":id/credential-health") credentialHealth(@Param("id") id: string) { return this.service.credentialHealth(id); }
  @Post() create(@Body() dto: CreateLineOfficialAccountDto) { return this.service.create(dto); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateLineOfficialAccountDto) { return this.service.update(id, dto); }
  @Patch(":id/status") status(@Param("id") id: string, @Body() dto: UpdateLineOaStatusDto) { return this.service.setStatus(id, dto.isActive); }
  @Post(":id/test-connection") test(@Param("id") id: string) { return this.service.testConnection(id); }
  @Roles("ADMIN") @Get(":id/webhook-info") webhookInfo(@Param("id") id: string) { return this.service.webhookInfo(id); }
  @Post(":id/regenerate-webhook") regenerateWebhook(@Param("id") id: string) { return this.service.regenerateWebhook(id); }
  @Delete(":id") remove(@Param("id") id: string) { return this.service.remove(id); }
  @Post(":id/archive") archive(@Param("id") id: string) { return this.service.archive(id); }
  @Post(":id/restore") restore(@Param("id") id: string) { return this.service.restore(id); }
}
