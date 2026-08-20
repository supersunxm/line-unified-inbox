import { Controller, ForbiddenException, Get, Query, Req } from "@nestjs/common";
import type { AuthRequest } from "./auth/auth.guard";
import { StoreAccessService } from "./auth/store-access.service";
import { MessageTrafficPeriod, MessageTrafficService } from "./message-traffic.service";
import { PrismaService } from "./prisma.service";

@Controller("dashboard")
export class MessageTrafficController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess: StoreAccessService,
    private readonly messageTraffic: MessageTrafficService,
  ) {}

  private parseRequestedStoreIds(raw?: string) {
    if (!raw) return undefined;
    const ids = [...new Set(raw.split(",").map((value) => value.trim()).filter(Boolean))];
    return ids.length > 0 ? ids : undefined;
  }

  private async resolveAllowedStoreIds(req: AuthRequest | undefined, allowedStoreIdsRaw?: string) {
    const user = req?.user;
    if (!user) throw new ForbiddenException("Authentication required");

    const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
    if (accessibleStoreIds !== null) return accessibleStoreIds;

    const requestedStoreIds = this.parseRequestedStoreIds(allowedStoreIdsRaw);
    if (!requestedStoreIds) return undefined;

    const activeStores = await this.prisma.store.findMany({
      where: { id: { in: requestedStoreIds }, isActive: true, archivedAt: null },
      select: { id: true },
    });
    const activeStoreIdSet = new Set(activeStores.map((store) => store.id));
    if (requestedStoreIds.some((storeId) => !activeStoreIdSet.has(storeId))) {
      throw new ForbiddenException("Requested store is not available");
    }

    return requestedStoreIds;
  }

  @Get("message-traffic")
  async getMessageTraffic(
    @Query("period") period?: MessageTrafficPeriod,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Req() req?: AuthRequest,
  ) {
    const safePeriod: MessageTrafficPeriod = period === "today" || period === "7d" || period === "30d"
      ? period
      : "30d";
    const allowedStoreIds = await this.resolveAllowedStoreIds(req, allowedStoreIdsRaw);
    return this.messageTraffic.getTraffic(safePeriod, allowedStoreIds);
  }
}
