import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { AuthUser } from "../auth/auth.guard";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";
import { PrismaService } from "../prisma.service";
import { CouponLineClientService } from "./coupon-line-client.service";
import { CouponScopeService } from "./coupon-scope.service";
import type {
  CouponCreateInput,
  CouponPreviewInput,
  CouponScopeItem,
  LineCouponPayload,
} from "./coupon.types";

type CampaignRow = {
  id: string;
  title: string;
  description: string | null;
  couponPayload: LineCouponPayload;
  status: string;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

type CampaignStoreRow = {
  id: string;
  campaignId: string;
  storeId: string;
  storeName: string;
  storeCode: string | null;
  lineOfficialAccountId: string | null;
  lineOaName: string | null;
  lineCouponId: string | null;
  status: string;
  skipReason: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  completedAt: Date | null;
};

type RetryRow = {
  id: string;
  storeId: string;
  lineOfficialAccountId: string | null;
  encryptedChannelAccessToken: string | null;
  lineCouponId: string | null;
};

@Injectable()
export class CouponService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: CouponScopeService,
    private readonly encryption: CredentialEncryptionService,
    private readonly lineClient: CouponLineClientService,
  ) {}

  async preview(input: CouponPreviewInput, user: AuthUser) {
    this.validateInput(input);
    const stores = await this.scope.resolve(input.storeSelection, user);
    return this.buildPreview(stores);
  }

  async create(input: CouponCreateInput, user: AuthUser) {
    this.validateInput(input);
    const stores = await this.scope.resolve(input.storeSelection, user);
    const campaignId = randomUUID();
    const now = new Date();

    await this.prisma.$executeRaw`
      INSERT INTO "CouponCampaign" (
        "id", "title", "description", "couponPayload", "status", "createdByUserId", "createdAt", "updatedAt"
      ) VALUES (
        ${campaignId}, ${input.coupon.title}, ${input.coupon.description ?? null}, ${JSON.stringify(input.coupon)}::jsonb,
        'CREATING', ${user.id}, ${now}, ${now}
      )
    `;

    for (const store of stores) {
      const status = store.isEligible ? "PENDING" : "SKIPPED";
      await this.prisma.$executeRaw`
        INSERT INTO "CouponCampaignStore" (
          "id", "campaignId", "storeId", "lineOfficialAccountId", "status", "skipReason", "createdAt", "updatedAt"
        ) VALUES (
          ${randomUUID()}, ${campaignId}, ${store.storeId}, ${store.lineOfficialAccountId}, ${status}, ${store.skipReason}, ${now}, ${now}
        )
      `;
    }

    const eligible = stores.filter((store) => store.isEligible);
    await this.runInBatches(eligible, 10, async (store) => {
      await this.createForStore(campaignId, store, input.coupon);
    });

    await this.refreshCampaignStatus(campaignId);
    return this.getCampaign(campaignId);
  }

  async retryFailed(campaignId: string) {
    const campaign = await this.getCampaignRow(campaignId);
    const failed = await this.prisma.$queryRaw<RetryRow[]>`
      SELECT
        cs."id",
        cs."storeId",
        cs."lineOfficialAccountId",
        oa."encryptedChannelAccessToken",
        cs."lineCouponId"
      FROM "CouponCampaignStore" cs
      LEFT JOIN "LineOfficialAccount" oa ON oa."id" = cs."lineOfficialAccountId"
      WHERE cs."campaignId" = ${campaignId}
        AND cs."status" = 'FAILED'
    `;

    await this.runInBatches(failed, 10, async (row) => {
      if (!row.lineOfficialAccountId || !row.encryptedChannelAccessToken) {
        await this.markStoreFailed(row.id, "MISSING_TOKEN", "Channel Access Token is unavailable");
        return;
      }
      try {
        const accessToken = this.encryption.decrypt(row.encryptedChannelAccessToken);
        const result = await this.lineClient.createCoupon(accessToken, campaign.couponPayload);
        await this.prisma.$executeRaw`
          UPDATE "CouponCampaignStore"
          SET "lineCouponId" = ${result.couponId}, "status" = 'SUCCESS', "errorCode" = NULL,
              "errorMessage" = NULL, "completedAt" = ${new Date()}, "updatedAt" = ${new Date()}
          WHERE "id" = ${row.id}
        `;
      } catch (error) {
        const sanitized = this.sanitizeError(error);
        await this.markStoreFailed(row.id, sanitized.code, sanitized.message);
      }
    });

    await this.refreshCampaignStatus(campaignId);
    return this.getCampaign(campaignId);
  }

  async discontinue(campaignId: string) {
    await this.getCampaignRow(campaignId);
    const rows = await this.prisma.$queryRaw<RetryRow[]>`
      SELECT
        cs."id",
        cs."storeId",
        cs."lineOfficialAccountId",
        oa."encryptedChannelAccessToken",
        cs."lineCouponId"
      FROM "CouponCampaignStore" cs
      LEFT JOIN "LineOfficialAccount" oa ON oa."id" = cs."lineOfficialAccountId"
      WHERE cs."campaignId" = ${campaignId}
        AND cs."status" = 'SUCCESS'
        AND cs."lineCouponId" IS NOT NULL
    `;

    await this.runInBatches(rows, 10, async (row) => {
      if (!row.lineCouponId || !row.encryptedChannelAccessToken) {
        await this.prisma.$executeRaw`
          UPDATE "CouponCampaignStore"
          SET "status" = 'DISCONTINUE_FAILED', "errorCode" = 'MISSING_TOKEN',
              "errorMessage" = 'Channel Access Token is unavailable', "updatedAt" = ${new Date()}
          WHERE "id" = ${row.id}
        `;
        return;
      }

      try {
        const accessToken = this.encryption.decrypt(row.encryptedChannelAccessToken);
        await this.lineClient.discontinueCoupon(accessToken, row.lineCouponId);
        await this.prisma.$executeRaw`
          UPDATE "CouponCampaignStore"
          SET "status" = 'DISCONTINUED', "errorCode" = NULL, "errorMessage" = NULL,
              "completedAt" = ${new Date()}, "updatedAt" = ${new Date()}
          WHERE "id" = ${row.id}
        `;
      } catch (error) {
        const sanitized = this.sanitizeError(error);
        await this.prisma.$executeRaw`
          UPDATE "CouponCampaignStore"
          SET "status" = 'DISCONTINUE_FAILED', "errorCode" = ${sanitized.code},
              "errorMessage" = ${sanitized.message}, "updatedAt" = ${new Date()}
          WHERE "id" = ${row.id}
        `;
      }
    });

    const summary = await this.storeStatusSummary(campaignId);
    const status = summary.DISCONTINUE_FAILED ? "PARTIAL_DISCONTINUE" : "DISCONTINUED";
    await this.prisma.$executeRaw`
      UPDATE "CouponCampaign" SET "status" = ${status}, "updatedAt" = ${new Date()} WHERE "id" = ${campaignId}
    `;
    return this.getCampaign(campaignId);
  }

  async listCampaigns(limit = 20, offset = 0) {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safeOffset = Math.max(offset, 0);
    const campaigns = await this.prisma.$queryRaw<CampaignRow[]>`
      SELECT * FROM "CouponCampaign"
      ORDER BY "createdAt" DESC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    return { items: campaigns, limit: safeLimit, offset: safeOffset };
  }

  async getCampaign(campaignId: string) {
    const campaign = await this.getCampaignRow(campaignId);
    const stores = await this.prisma.$queryRaw<CampaignStoreRow[]>`
      SELECT
        cs."id", cs."campaignId", cs."storeId", s."name" AS "storeName", s."code" AS "storeCode",
        cs."lineOfficialAccountId", oa."name" AS "lineOaName", cs."lineCouponId", cs."status",
        cs."skipReason", cs."errorCode", cs."errorMessage", cs."completedAt"
      FROM "CouponCampaignStore" cs
      INNER JOIN "Store" s ON s."id" = cs."storeId"
      LEFT JOIN "LineOfficialAccount" oa ON oa."id" = cs."lineOfficialAccountId"
      WHERE cs."campaignId" = ${campaignId}
      ORDER BY s."name" ASC
    `;
    return { campaign, summary: this.summarizeRows(stores), stores };
  }

  private async createForStore(campaignId: string, store: CouponScopeItem, payload: LineCouponPayload) {
    if (!store.encryptedChannelAccessToken) return;
    try {
      const accessToken = this.encryption.decrypt(store.encryptedChannelAccessToken);
      const result = await this.lineClient.createCoupon(accessToken, payload);
      await this.prisma.$executeRaw`
        UPDATE "CouponCampaignStore"
        SET "lineCouponId" = ${result.couponId}, "status" = 'SUCCESS', "completedAt" = ${new Date()},
            "errorCode" = NULL, "errorMessage" = NULL, "updatedAt" = ${new Date()}
        WHERE "campaignId" = ${campaignId} AND "storeId" = ${store.storeId}
      `;
    } catch (error) {
      const sanitized = this.sanitizeError(error);
      await this.prisma.$executeRaw`
        UPDATE "CouponCampaignStore"
        SET "status" = 'FAILED', "errorCode" = ${sanitized.code}, "errorMessage" = ${sanitized.message},
            "completedAt" = ${new Date()}, "updatedAt" = ${new Date()}
        WHERE "campaignId" = ${campaignId} AND "storeId" = ${store.storeId}
      `;
    }
  }

  private async markStoreFailed(id: string, code: string, message: string) {
    await this.prisma.$executeRaw`
      UPDATE "CouponCampaignStore"
      SET "status" = 'FAILED', "errorCode" = ${code}, "errorMessage" = ${message},
          "completedAt" = ${new Date()}, "updatedAt" = ${new Date()}
      WHERE "id" = ${id}
    `;
  }

  private async refreshCampaignStatus(campaignId: string) {
    const summary = await this.storeStatusSummary(campaignId);
    const success = summary.SUCCESS ?? 0;
    const failed = summary.FAILED ?? 0;
    const skipped = summary.SKIPPED ?? 0;
    const status = success === 0 ? "FAILED" : failed > 0 || skipped > 0 ? "PARTIAL" : "SUCCESS";
    await this.prisma.$executeRaw`
      UPDATE "CouponCampaign" SET "status" = ${status}, "updatedAt" = ${new Date()} WHERE "id" = ${campaignId}
    `;
  }

  private async storeStatusSummary(campaignId: string): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT "status", COUNT(*)::bigint AS "count"
      FROM "CouponCampaignStore" WHERE "campaignId" = ${campaignId}
      GROUP BY "status"
    `;
    return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
  }

  private async getCampaignRow(campaignId: string): Promise<CampaignRow> {
    const rows = await this.prisma.$queryRaw<CampaignRow[]>`
      SELECT * FROM "CouponCampaign" WHERE "id" = ${campaignId} LIMIT 1
    `;
    if (!rows[0]) throw new NotFoundException("Coupon campaign not found");
    return rows[0];
  }

  private buildPreview(stores: CouponScopeItem[]) {
    const eligible = stores.filter((store) => store.isEligible);
    const skipped = stores.filter((store) => !store.isEligible);
    const skipReasons = skipped.reduce<Record<string, number>>((acc, store) => {
      const reason = store.skipReason ?? "UNKNOWN";
      acc[reason] = (acc[reason] ?? 0) + 1;
      return acc;
    }, {});
    return {
      totalStores: stores.length,
      eligibleStores: eligible.length,
      skippedStores: skipped.length,
      skipReasons,
      stores: stores.map(({ encryptedChannelAccessToken: _token, ...store }) => store),
    };
  }

  private summarizeRows(rows: CampaignStoreRow[]) {
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, { total: rows.length });
  }

  private validateInput(input: CouponPreviewInput) {
    const coupon = input?.coupon;
    if (!coupon || !input.storeSelection) throw new BadRequestException("Coupon and store selection are required");
    if (!coupon.title?.trim() || coupon.title.length > 60) throw new BadRequestException("Coupon title must be 1-60 characters");
    if ((coupon.description?.length ?? 0) > 1000) throw new BadRequestException("Coupon description must be at most 1000 characters");
    if (!Number.isInteger(coupon.startTimestamp) || !Number.isInteger(coupon.endTimestamp) || coupon.endTimestamp <= coupon.startTimestamp) {
      throw new BadRequestException("Coupon validity timestamps are invalid");
    }
    if (coupon.timezone !== "ASIA_BANGKOK") throw new BadRequestException("Coupon timezone must be ASIA_BANGKOK");
    if (coupon.visibility !== "PUBLIC" && coupon.visibility !== "UNLISTED") throw new BadRequestException("Invalid coupon visibility");
    if (coupon.maxUseCountPerTicket !== 1 && coupon.maxUseCountPerTicket !== -1) throw new BadRequestException("Invalid maxUseCountPerTicket");
    if (coupon.imageUrl && !coupon.imageUrl.startsWith("https://")) throw new BadRequestException("Coupon image URL must use HTTPS");

    if (coupon.acquisitionCondition.type === "lottery") {
      const probability = coupon.acquisitionCondition.lotteryProbability;
      if (!Number.isInteger(probability) || probability < 1 || probability > 99) throw new BadRequestException("Lottery probability must be 1-99");
      const maxAcquireCount = coupon.acquisitionCondition.maxAcquireCount;
      if (maxAcquireCount !== undefined && maxAcquireCount !== -1 && (!Number.isInteger(maxAcquireCount) || maxAcquireCount < 1 || maxAcquireCount > 999999)) {
        throw new BadRequestException("Invalid lottery maxAcquireCount");
      }
    }

    if (coupon.reward.type === "discount" || coupon.reward.type === "cashBack") {
      const price = coupon.reward.priceInfo;
      if (price.type === "fixed" && (!Number.isInteger(price.fixedAmount) || price.fixedAmount <= 0)) throw new BadRequestException("Fixed amount must be a positive integer");
      if (price.type === "percentage" && (!Number.isInteger(price.percentage) || price.percentage < 1 || price.percentage > 100)) throw new BadRequestException("Percentage must be 1-100");
      if (price.type === "explicit" && (price.originalPrice <= 0 || price.priceAfterDiscount < 0 || price.priceAfterDiscount >= price.originalPrice)) {
        throw new BadRequestException("Explicit discount prices are invalid");
      }
    }
  }

  private sanitizeError(error: unknown): { code: string; message: string } {
    if (typeof error === "object" && error !== null && "status" in error) {
      const status = String((error as { status?: unknown }).status ?? "LINE_ERROR");
      const response = "response" in error ? (error as { response?: unknown }).response : undefined;
      const message = typeof response === "string" ? response : error instanceof Error ? error.message : "LINE Coupon API request failed";
      return { code: status, message: message.slice(0, 500) };
    }
    return { code: "LINE_ERROR", message: error instanceof Error ? error.message.slice(0, 500) : "LINE Coupon API request failed" };
  }

  private async runInBatches<T>(items: T[], size: number, worker: (item: T) => Promise<void>) {
    for (let index = 0; index < items.length; index += size) {
      const batch = items.slice(index, index + size);
      await Promise.all(batch.map(worker));
    }
  }
}
