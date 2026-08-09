import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { CreateLineOfficialAccountDto, ExportLineOfficialAccountsDto, UpdateLineOfficialAccountDto, UpdateLineOaStatusDto } from "./line-official-account.dto";
import { LineOfficialAccountsService } from "./line-official-accounts.service";
import { Roles } from "../auth/auth.decorators";

@Controller("line-official-accounts")
export class LineOfficialAccountsController {
  constructor(private readonly service: LineOfficialAccountsService) {}
  @Get() list(@Query("showArchived") showArchived?: string) { return this.service.list(showArchived === "true"); }
  @Roles("ADMIN")
  @Get("export.csv") async exportCsv(@Query() query: ExportLineOfficialAccountsDto, @Res() response: Response) {
    const result = await this.service.exportCsv(query);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    response.setHeader("X-Export-Row-Count", String(result.rowCount));
    response.send(result.csv);
  }
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
