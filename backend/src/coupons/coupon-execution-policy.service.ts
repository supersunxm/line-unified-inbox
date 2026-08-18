import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import type { CouponStoreSelection } from "./coupon.types";

type CampaignStoreCountRow = { count: bigint };

@Injectable()
export class CouponExecutionPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  assertSelection(selection: CouponStoreSelection) {
    if (this.executionMode() === "full") return;

    const storeIds = selection.mode === "SELECTED" ? selection.storeIds ?? [] : [];
    if (selection.mode !== "SELECTED" || storeIds.length !== 1) {
      throw new BadRequestException(
        "Coupon pilot mode allows exactly one selected store per campaign. Set COUPON_EXECUTION_MODE=full only after the pilot is approved.",
      );
    }
  }

  async assertCampaign(campaignId: string) {
    if (this.executionMode() === "full") return;

    const rows = await this.prisma.$queryRaw<CampaignStoreCountRow[]>`
      SELECT COUNT(DISTINCT "storeId")::bigint AS "count"
      FROM "CouponCampaignStore"
      WHERE "campaignId" = ${campaignId}
    `;
    const count = Number(rows[0]?.count ?? 0n);
    if (count > 1) {
      throw new BadRequestException(
        "Coupon pilot mode blocks actions on multi-store campaigns. Set COUPON_EXECUTION_MODE=full only after the pilot is approved.",
      );
    }
  }

  getMode(): "pilot" | "full" {
    return this.executionMode();
  }

  private executionMode(): "pilot" | "full" {
    return process.env.COUPON_EXECUTION_MODE?.trim().toLowerCase() === "full" ? "full" : "pilot";
  }
}
