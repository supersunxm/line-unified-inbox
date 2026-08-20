import { BadRequestException, Controller, ForbiddenException, Get, Query, Req } from "@nestjs/common";
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

  private parseDate(value: string | undefined, label: string) {
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(`${label} must use YYYY-MM-DD format`);
    }
    const [year, month, day] = value.split("-").map(Number);
    const utc = new Date(Date.UTC(year, month - 1, day));
    if (
      utc.getUTCFullYear() !== year ||
      utc.getUTCMonth() !== month - 1 ||
      utc.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${label} is not a valid date`);
    }
    return value;
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
    @Query("from") fromRaw?: string,
    @Query("to") toRaw?: string,
    @Query("allowedStoreIds") allowedStoreIdsRaw?: string,
    @Req() req?: AuthRequest,
  ) {
    const safePeriod: MessageTrafficPeriod = period === "today" || period === "7d" || period === "30d"
      ? period
      : "30d";
    const from = this.parseDate(fromRaw, "from");
    const to = this.parseDate(toRaw, "to");
    if ((from && !to) || (!from && to)) {
      throw new BadRequestException("from and to must be provided together");
    }
    if (from && to && from > to) {
      throw new BadRequestException("from must be on or before to");
    }

    const allowedStoreIds = await this.resolveAllowedStoreIds(req, allowedStoreIdsRaw);
    return this.messageTraffic.getTraffic(safePeriod, allowedStoreIds, from && to ? { from, to } : undefined);
  }
}
