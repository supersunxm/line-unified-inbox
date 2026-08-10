import { Controller, ForbiddenException, Get, Post, Query } from "@nestjs/common";
import { StoreMasterService } from "./store-master.service";
import { Roles } from "../auth/auth.decorators";

@Controller("store-master")
export class StoreMasterController {
  constructor(private readonly service: StoreMasterService) {}
  @Get("search") search(@Query("q") query = "", @Query("limit") rawLimit = "10") {
    const parsedLimit = Number.parseInt(rawLimit, 10);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 50) : 10;
    return this.service.search(query, limit);
  }
  @Get("validation") validate() { return this.service.validate(); }
  @Post("import") importConfigured() { if (process.env.NODE_ENV === "production") throw new ForbiddenException("The development import endpoint is disabled in production"); return this.service.importFromConfiguredSource(); }
  @Roles("ADMIN")
  @Post("sync") sync() { return this.service.syncFromGoogleSheet(); }
}
