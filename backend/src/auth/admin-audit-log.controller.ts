import { Controller, Get, Query } from "@nestjs/common";
import { Roles } from "./auth.decorators";
import { AuditLogService } from "./audit-log.service";

@Controller("admin/audit-logs")
@Roles("ADMIN")
export class AdminAuditLogController {
  constructor(private readonly audit: AuditLogService) {}
  @Get()
  list(@Query("page") page?: string, @Query("pageSize") pageSize?: string, @Query("action") action?: string, @Query("from") from?: string, @Query("to") to?: string) {
    return this.audit.list({ page: Number(page) || 1, pageSize: Number(pageSize) || 50, action, from, to });
  }
}
