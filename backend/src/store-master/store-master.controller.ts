import { BadRequestException, Body, Controller, ForbiddenException, Get, Post, Query } from "@nestjs/common";
import { StoreMasterService } from "./store-master.service";
import { Roles } from "../auth/auth.decorators";
import { parseStoreMasterApprovedChangeSet, type StoreMasterApprovedChange } from "./store-master-approval";

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
  @Post("sync") sync(@Body() body: unknown = {}) {
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new BadRequestException("Store Master sync request must be an object");
    }
    const request = body as Record<string, unknown>;
    const allowedKeys = ["apply", "expectedSha256", "approvedChangeSet"];
    if (Object.keys(request).some((key) => !allowedKeys.includes(key))) {
      throw new BadRequestException("Store Master sync request contains unsupported fields");
    }
    if (request.apply !== undefined && typeof request.apply !== "boolean") {
      throw new BadRequestException("Store Master apply must be a boolean");
    }
    if (request.expectedSha256 !== undefined && typeof request.expectedSha256 !== "string") {
      throw new BadRequestException("Store Master source fingerprint must be a string");
    }
    let approvedChangeSet: StoreMasterApprovedChange[] = [];
    try {
      if (request.approvedChangeSet !== undefined) {
        approvedChangeSet = parseStoreMasterApprovedChangeSet(request.approvedChangeSet);
      }
    } catch (error: unknown) {
      throw new BadRequestException(error instanceof Error ? error.message : "Invalid Store Master change set");
    }
    return this.service.syncFromGoogleSheet(undefined, {
      apply: request.apply === true,
      expectedSha256: request.expectedSha256,
      approvedChangeSet,
    });
  }
}
