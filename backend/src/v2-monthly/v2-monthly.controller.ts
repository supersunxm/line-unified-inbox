import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { Roles } from "../auth/auth.decorators";
import type { AuthRequest } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { StorePartnersService } from "./store-partners.service";
import { SetStorePartnerDto } from "./v2-monthly.dto";

@Controller("v2")
export class V2MonthlyController {
  constructor(private readonly partners: StorePartnersService, private readonly storeAccess: StoreAccessService) {}

  private async scope(req: AuthRequest) {
    if (!req.user) throw new ForbiddenException("Authentication required");
    return this.storeAccess.accessibleStoreIds(req.user);
  }

  /** Store → partner for the caller's stores (v2 reads partner only from here). */
  @Get("store-partners")
  async listStorePartners(@Req() req: AuthRequest) {
    return { stores: await this.partners.list(await this.scope(req)) };
  }

  @Get("store-partners/changes")
  @Roles("ADMIN")
  async storePartnerChanges(@Query("storeId") storeId?: string, @Query("limit") limit?: string) {
    return { changes: await this.partners.changes(storeId?.trim() || null, Number(limit) || 50) };
  }

  @Put("store-partners/:storeId")
  @Roles("ADMIN")
  async setStorePartner(@Param("storeId") storeId: string, @Body() body: SetStorePartnerDto, @Req() req: AuthRequest) {
    const user = req.user!;
    return this.partners.setPartner(storeId, body.partner ?? null, { id: user.id, name: user.displayName || user.email }, body.reason ?? null);
  }

  /** Idempotent: does nothing once the seed has run. */
  @Post("store-partners/seed")
  @Roles("ADMIN")
  async seedStorePartners() {
    return this.partners.seedFromStoreNames();
  }
}
