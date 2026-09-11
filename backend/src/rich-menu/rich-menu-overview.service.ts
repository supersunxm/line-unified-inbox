import { Injectable } from "@nestjs/common";
import { RichMenuPublishStatus } from "@prisma/client";
import { PrismaService } from "../prisma.service";
import { extractTemplateVariables } from "../store-master/template-variable-resolver";
import type { RichMenuArea } from "./rich-menu.types";

export type RichMenuOverviewStatus = "STANDARD" | "FALLBACK" | "NEEDS_ACTION" | "OUTDATED";
export type RichMenuRecommendedVariant = "STANDARD" | "NO_MAPS" | "NO_TIKTOK" | "BASIC";

export type RichMenuOverviewItem = {
  lineOfficialAccountId: string;
  lineOfficialAccountName: string;
  storeId: string | null;
  externalStoreId: string | null;
  storeName: string;
  province: string | null;
  region: string | null;
  googleMapsUrl: string | null;
  tiktokUrl: string | null;
  currentTemplateId: string | null;
  currentTemplateName: string | null;
  publishedTemplateVersion: number | null;
  currentTemplateVersion: number | null;
  lastPublishedAt: string | null;
  lastAttemptStatus: string | null;
  lastAttemptError: string | null;
  overviewStatus: RichMenuOverviewStatus;
  recommendedVariant: RichMenuRecommendedVariant;
  reason: string;
};

@Injectable()
export class RichMenuOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(): Promise<{
    generatedAt: string;
    source: "LAST_PUBLISHED_ATTEMPT";
    summary: { total: number; standard: number; fallback: number; needsAction: number; outdated: number };
    items: RichMenuOverviewItem[];
  }> {
    const accounts = await this.prisma.lineOfficialAccount.findMany({
      where: { accountType: "STORE" },
      include: { store: { include: { storeMaster: true } } },
      orderBy: { name: "asc" },
    });

    const accountIds = accounts.map((account) => account.id);
    const [publishedAttempts, latestAttempts] = await Promise.all([
      this.prisma.richMenuPublishAttempt.findMany({
        where: {
          lineOfficialAccountId: { in: accountIds },
          status: RichMenuPublishStatus.PUBLISHED,
        },
        include: {
          template: {
            select: { id: true, name: true, version: true, areasJson: true },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.richMenuPublishAttempt.findMany({
        where: { lineOfficialAccountId: { in: accountIds } },
        select: {
          lineOfficialAccountId: true,
          status: true,
          errorMessage: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const latestPublishedByAccount = new Map<string, (typeof publishedAttempts)[number]>();
    for (const attempt of publishedAttempts) {
      if (!latestPublishedByAccount.has(attempt.lineOfficialAccountId)) {
        latestPublishedByAccount.set(attempt.lineOfficialAccountId, attempt);
      }
    }

    const latestAttemptByAccount = new Map<string, (typeof latestAttempts)[number]>();
    for (const attempt of latestAttempts) {
      if (!latestAttemptByAccount.has(attempt.lineOfficialAccountId)) {
        latestAttemptByAccount.set(attempt.lineOfficialAccountId, attempt);
      }
    }

    const items = accounts.map((account): RichMenuOverviewItem => {
      const storeMaster = account.store?.storeMaster ?? null;
      const published = latestPublishedByAccount.get(account.id) ?? null;
      const latestAttempt = latestAttemptByAccount.get(account.id) ?? null;
      const googleMapsUrl = storeMaster?.googleMapsUrl?.trim() || null;
      const tiktokUrl = storeMaster?.tiktokProfileUrl?.trim() || null;
      const missingMaps = !googleMapsUrl;
      const missingTikTok = !tiktokUrl;
      const recommendedVariant: RichMenuRecommendedVariant = missingMaps && missingTikTok
        ? "BASIC"
        : missingMaps
          ? "NO_MAPS"
          : missingTikTok
            ? "NO_TIKTOK"
            : "STANDARD";

      if (!published) {
        return {
          lineOfficialAccountId: account.id,
          lineOfficialAccountName: account.name,
          storeId: account.store?.id ?? null,
          externalStoreId: storeMaster?.externalStoreId ?? null,
          storeName: account.store?.name || account.name,
          province: storeMaster?.province ?? account.store?.area ?? null,
          region: storeMaster?.region ?? account.store?.region ?? null,
          googleMapsUrl,
          tiktokUrl,
          currentTemplateId: null,
          currentTemplateName: null,
          publishedTemplateVersion: null,
          currentTemplateVersion: null,
          lastPublishedAt: null,
          lastAttemptStatus: latestAttempt?.status ?? null,
          lastAttemptError: latestAttempt?.errorMessage ?? null,
          overviewStatus: "NEEDS_ACTION",
          recommendedVariant,
          reason: this.buildMissingPublishReason(missingMaps, missingTikTok),
        };
      }

      const areas = (published.template.areasJson as unknown as RichMenuArea[]) || [];
      const variables = new Set<string>();
      for (const area of areas) {
        for (const variable of extractTemplateVariables(area.actionData || "")) variables.add(variable);
      }
      const requiresMaps = variables.has("store.googleMapsUrl") || variables.has("googleMapsUrl");
      const requiresTikTok = variables.has("store.tiktokUrl") || variables.has("store.tiktokProfileUrl") || variables.has("tiktokUrl");
      const incompatible = (missingMaps && requiresMaps) || (missingTikTok && requiresTikTok);
      const outdated = published.templateVersion < published.template.version;

      let overviewStatus: RichMenuOverviewStatus = "STANDARD";
      let reason = "ข้อมูลร้านครบและใช้ Rich Menu ที่ publish สำเร็จล่าสุด";

      if (incompatible) {
        overviewStatus = "NEEDS_ACTION";
        reason = this.buildIncompatibleReason(missingMaps && requiresMaps, missingTikTok && requiresTikTok);
      } else if (outdated) {
        overviewStatus = "OUTDATED";
        reason = `Rich Menu ที่ใช้อยู่เป็น v${published.templateVersion} แต่ template ปัจจุบันเป็น v${published.template.version}`;
      } else if (missingMaps || missingTikTok) {
        overviewStatus = "FALLBACK";
        reason = this.buildFallbackReason(missingMaps, missingTikTok);
      }

      return {
        lineOfficialAccountId: account.id,
        lineOfficialAccountName: account.name,
        storeId: account.store?.id ?? null,
        externalStoreId: storeMaster?.externalStoreId ?? null,
        storeName: account.store?.name || account.name,
        province: storeMaster?.province ?? account.store?.area ?? null,
        region: storeMaster?.region ?? account.store?.region ?? null,
        googleMapsUrl,
        tiktokUrl,
        currentTemplateId: published.template.id,
        currentTemplateName: published.template.name,
        publishedTemplateVersion: published.templateVersion,
        currentTemplateVersion: published.template.version,
        lastPublishedAt: published.completedAt?.toISOString() ?? published.createdAt.toISOString(),
        lastAttemptStatus: latestAttempt?.status ?? null,
        lastAttemptError: latestAttempt?.errorMessage ?? null,
        overviewStatus,
        recommendedVariant,
        reason,
      };
    });

    const summary = items.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.overviewStatus === "STANDARD") acc.standard += 1;
        if (item.overviewStatus === "FALLBACK") acc.fallback += 1;
        if (item.overviewStatus === "NEEDS_ACTION") acc.needsAction += 1;
        if (item.overviewStatus === "OUTDATED") acc.outdated += 1;
        return acc;
      },
      { total: 0, standard: 0, fallback: 0, needsAction: 0, outdated: 0 },
    );

    return {
      generatedAt: new Date().toISOString(),
      source: "LAST_PUBLISHED_ATTEMPT",
      summary,
      items,
    };
  }

  private buildMissingPublishReason(missingMaps: boolean, missingTikTok: boolean): string {
    const gaps = this.formatGaps(missingMaps, missingTikTok);
    return gaps.length > 0
      ? `ยังไม่มี Rich Menu ที่ publish สำเร็จ; แนะนำรูปแบบที่ไม่พึ่ง ${gaps.join(" และ ")}`
      : "ยังไม่มี Rich Menu ที่ publish สำเร็จ";
  }

  private buildFallbackReason(missingMaps: boolean, missingTikTok: boolean): string {
    const gaps = this.formatGaps(missingMaps, missingTikTok);
    return `ใช้ Rich Menu สำรองได้ เพราะ template ปัจจุบันไม่พึ่ง ${gaps.join(" และ ")}`;
  }

  private buildIncompatibleReason(missingMaps: boolean, missingTikTok: boolean): string {
    const gaps = this.formatGaps(missingMaps, missingTikTok);
    return `Rich Menu ที่ใช้อยู่ต้องใช้ ${gaps.join(" และ ")} แต่ข้อมูลร้านไม่มี; ควรเปลี่ยนเป็น fallback`;
  }

  private formatGaps(missingMaps: boolean, missingTikTok: boolean): string[] {
    const gaps: string[] = [];
    if (missingMaps) gaps.push("Google Maps URL");
    if (missingTikTok) gaps.push("TikTok URL");
    return gaps;
  }
}
