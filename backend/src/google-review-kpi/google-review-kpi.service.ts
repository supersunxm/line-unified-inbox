import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma.service";
import {
  AggregateWeeklyKpiDto,
  CheckGoogleReviewKpiResultDto,
  CompleteStoreAuditDto,
  FailStoreAuditDto,
  GoogleReviewAuditQueueStoreItem,
  GoogleReviewAuditSessionResponse,
  GoogleReviewDailyBreakdownItem,
  GoogleReviewKpiStoreItem,
  GoogleReviewKpiSummary,
  GoogleReviewWeeklyLeaderboardResponse,
  GoogleReviewWeeklyCollectorStatusResponse,
  GoogleReviewWeeklyPeriodItem,
  GoogleReviewWeeklyRankItem,
  GoogleReviewWeeklyStoreItem,
  LOCKED_WEEKLY_KPI_STORE_CODES,
  MONTH_REGEX,
  QueryGoogleReviewKpiDto,
  QueryWeeklyLeaderboardDto,
  RecordDailyKpiDto,
  StartMonthlyAuditDto,
  UpdateAuditSessionStatusDto,
} from "./google-review-kpi.dto";
import {
  generateWeeklyPeriods,
  getBangkokDateParts,
  getWeeklyPeriod,
  resolveWeekNumber,
} from "./weekly-period.util";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import {
  GoogleReviewAuditCoverageStatus,
  GoogleReviewAuditSessionStatus,
  GoogleReviewAuditStoreStatus,
  GoogleReviewPeriodStatus,
  SessionType,
} from "@prisma/client";

/** Lifetime of a batch-runner token: 30 minutes. */
const RUNNER_TOKEN_TTL_MS = 30 * 60 * 1000;

export function getCurrentYearMonthBangkok(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
  });
  return formatter.format(new Date()).slice(0, 7);
}

@Injectable()
export class GoogleReviewKpiService {
  private readonly logger = new Logger(GoogleReviewKpiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storeAccess?: StoreAccessService,
  ) {}

  async listMonthlyKpis(
    dto: QueryGoogleReviewKpiDto,
    user?: AuthUser,
  ): Promise<GoogleReviewKpiSummary> {
    const month = dto.month?.trim() || getCurrentYearMonthBangkok();
    if (!MONTH_REGEX.test(month)) {
      throw new BadRequestException("month must be in YYYY-MM format (e.g. 2026-08)");
    }

    let storeScope: { id?: { in: string[] } } = {};
    if (user && this.storeAccess) {
      const accessibleStoreIds = await this.storeAccess.accessibleStoreIds(user);
      if (accessibleStoreIds !== null) {
        storeScope = { id: { in: accessibleStoreIds } };
      }
    }

    const stores = await this.prisma.store.findMany({
      where: {
        archivedAt: null,
        isActive: true,
        ...storeScope,
      },
      orderBy: { name: "asc" },
      include: {
        storeMaster: {
          select: {
            externalStoreId: true,
            googleMapsUrl: true,
            province: true,
            region: true,
          },
        },
        googleReviewKpiResults: {
          where: { month },
          include: {
            checkedByUser: {
              select: {
                id: true,
                displayName: true,
                email: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    let totalStores = 0;
    let storesWithGoogleMaps = 0;
    let checkedStores = 0;
    let uncheckedStores = 0;
    let passedStores = 0;
    let belowTargetStores = 0;
    let totalQualifiedReviews = 0;
    let totalReviewsChecked = 0;

    const storeItems: GoogleReviewKpiStoreItem[] = stores.map((store) => {
      totalStores++;
      const googleMapsUrl = store.storeMaster?.googleMapsUrl?.trim() || null;
      const hasGoogleMaps = Boolean(googleMapsUrl);
      if (hasGoogleMaps) storesWithGoogleMaps++;

      const kpiRecord = store.googleReviewKpiResults[0] ?? null;
      let kpiResult: GoogleReviewKpiStoreItem["kpiResult"] = null;

      if (kpiRecord) {
        checkedStores++;
        totalReviewsChecked += kpiRecord.reviewsChecked;
        totalQualifiedReviews += kpiRecord.qualifiedReviews;
        const target = kpiRecord.targetQualifiedReviews || 10;
        const isPassed = kpiRecord.qualifiedReviews >= target;

        if (isPassed) {
          passedStores++;
        } else {
          belowTargetStores++;
        }

        kpiResult = {
          id: kpiRecord.id,
          month: kpiRecord.month,
          reviewsChecked: kpiRecord.reviewsChecked,
          reviewsWithPhoto: kpiRecord.reviewsWithPhoto,
          photoReviewsInTargetMonth: kpiRecord.photoReviewsInTargetMonth,
          reviewsOver15ThaiWords: kpiRecord.reviewsOver15ThaiWords,
          qualifiedReviews: kpiRecord.qualifiedReviews,
          qualificationRuleVersion: kpiRecord.qualificationRuleVersion,
          targetQualifiedReviews: target,
          isPassed,
          checkedAt: kpiRecord.checkedAt.toISOString(),
          checkedBy: kpiRecord.checkedByUser
            ? {
                id: kpiRecord.checkedByUser.id,
                displayName: kpiRecord.checkedByUser.displayName,
                email: kpiRecord.checkedByUser.email,
              }
            : null,
        };
      } else {
        uncheckedStores++;
      }

      return {
        id: store.id,
        storeId: store.storeMaster?.externalStoreId ?? store.code ?? null,
        name: store.name,
        code: store.code,
        region: store.storeMaster?.region ?? store.region ?? null,
        province: store.storeMaster?.province ?? store.area ?? null,
        googleMapsUrl,
        hasGoogleMaps,
        kpiResult,
      };
    });

    return {
      month,
      totalStores,
      storesWithGoogleMaps,
      checkedStores,
      uncheckedStores,
      passedStores,
      belowTargetStores,
      totalQualifiedReviews,
      totalReviewsChecked,
      stores: storeItems,
    };
  }

  async getStoreKpi(storeIdentifier: string, month?: string) {
    const store = await this.resolveStore(storeIdentifier);
    const selectedMonth = month?.trim();

    if (selectedMonth) {
      if (!MONTH_REGEX.test(selectedMonth)) {
        throw new BadRequestException("month must be in YYYY-MM format (e.g. 2026-08)");
      }
      const kpi = await this.prisma.googleReviewKpiResult.findUnique({
        where: {
          storeId_month: {
            storeId: store.id,
            month: selectedMonth,
          },
        },
        include: {
          checkedByUser: {
            select: { id: true, displayName: true, email: true },
          },
        },
      });

      return {
        store: {
          id: store.id,
          storeId: store.storeMaster?.externalStoreId ?? store.code ?? null,
          name: store.name,
          code: store.code,
          googleMapsUrl: store.storeMaster?.googleMapsUrl ?? null,
        },
        month: selectedMonth,
        kpiResult: kpi,
      };
    }

    const history = await this.prisma.googleReviewKpiResult.findMany({
      where: { storeId: store.id },
      orderBy: { month: "desc" },
      include: {
        checkedByUser: {
          select: { id: true, displayName: true, email: true },
        },
      },
    });

    return {
      store: {
        id: store.id,
        storeId: store.storeMaster?.externalStoreId ?? store.code ?? null,
        name: store.name,
        code: store.code,
        googleMapsUrl: store.storeMaster?.googleMapsUrl ?? null,
      },
      history,
    };
  }

  async recordCheckResult(dto: CheckGoogleReviewKpiResultDto, user?: AuthUser) {
    if (!MONTH_REGEX.test(dto.month)) {
      throw new BadRequestException("month must be in YYYY-MM format (e.g. 2026-08)");
    }

    const {
      reviewsChecked,
      reviewsWithPhoto,
      reviewsOver15ThaiWords,
      qualifiedReviews,
      targetQualifiedReviews = 10,
    } = dto;

    if (
      reviewsChecked < 0 ||
      reviewsWithPhoto < 0 ||
      reviewsOver15ThaiWords < 0 ||
      qualifiedReviews < 0 ||
      targetQualifiedReviews < 0
    ) {
      throw new BadRequestException("Review metric counts cannot be negative");
    }

    if (qualifiedReviews > reviewsChecked) {
      throw new BadRequestException(
        `qualifiedReviews (${qualifiedReviews}) cannot exceed reviewsChecked (${reviewsChecked})`,
      );
    }
    if (reviewsWithPhoto > reviewsChecked) {
      throw new BadRequestException(
        `reviewsWithPhoto (${reviewsWithPhoto}) cannot exceed reviewsChecked (${reviewsChecked})`,
      );
    }
    if (reviewsOver15ThaiWords > reviewsChecked) {
      throw new BadRequestException(
        `reviewsOver15ThaiWords (${reviewsOver15ThaiWords}) cannot exceed reviewsChecked (${reviewsChecked})`,
      );
    }
    if (qualifiedReviews > reviewsWithPhoto) {
      throw new BadRequestException(
        `qualifiedReviews (${qualifiedReviews}) cannot exceed reviewsWithPhoto (${reviewsWithPhoto}) because a qualified review requires a photo`,
      );
    }
    if (qualifiedReviews > reviewsOver15ThaiWords) {
      throw new BadRequestException(
        `qualifiedReviews (${qualifiedReviews}) cannot exceed reviewsOver15ThaiWords (${reviewsOver15ThaiWords}) because a qualified review requires >15 Thai words`,
      );
    }

    const store = await this.resolveStore(dto.storeId);

    const result = await this.prisma.googleReviewKpiResult.upsert({
      where: {
        storeId_month: {
          storeId: store.id,
          month: dto.month,
        },
      },
      update: {
        reviewsChecked,
        reviewsWithPhoto,
        photoReviewsInTargetMonth: dto.photoReviewsInTargetMonth || 0,
        reviewsOver15ThaiWords,
        qualifiedReviews,
        qualificationRuleVersion: dto.qualificationRuleVersion || "IMAGE_CAPTURE_MONTH_V1",
        targetQualifiedReviews,
        checkedAt: new Date(),
        checkedByUserId: user?.id ?? null,
      },
      create: {
        storeId: store.id,
        month: dto.month,
        reviewsChecked,
        reviewsWithPhoto,
        photoReviewsInTargetMonth: dto.photoReviewsInTargetMonth || 0,
        reviewsOver15ThaiWords,
        qualifiedReviews,
        qualificationRuleVersion: dto.qualificationRuleVersion || "IMAGE_CAPTURE_MONTH_V1",
        targetQualifiedReviews,
        checkedAt: new Date(),
        checkedByUserId: user?.id ?? null,
      },
      include: {
        checkedByUser: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    this.logger.log(
      `Recorded Google Review KPI for store=${store.name} (${store.id}) month=${dto.month} qualified=${qualifiedReviews}/${reviewsChecked}`,
    );

    return {
      success: true,
      data: {
        ...result,
        store: {
          id: store.id,
          storeId: store.storeMaster?.externalStoreId ?? store.code ?? null,
          name: store.name,
          code: store.code,
          googleMapsUrl: store.storeMaster?.googleMapsUrl ?? null,
        },
      },
    };
  }

  private async resolveStore(storeIdentifier: string) {
    const trimmed = storeIdentifier.trim();
    if (!trimmed) {
      throw new BadRequestException("storeId is required");
    }

    // 1. Match by Store.id (UUID)
    let store = await this.prisma.store.findUnique({
      where: { id: trimmed },
      include: {
        storeMaster: {
          select: {
            externalStoreId: true,
            googleMapsUrl: true,
            province: true,
            region: true,
          },
        },
      },
    });

    if (!store) {
      // 2. Match by Store.code
      store = await this.prisma.store.findUnique({
        where: { code: trimmed },
        include: {
          storeMaster: {
            select: {
              externalStoreId: true,
              googleMapsUrl: true,
              province: true,
              region: true,
            },
          },
        },
      });
    }

    if (!store) {
      // 3. Match by StoreMaster.externalStoreId
      const storeMaster = await this.prisma.storeMaster.findFirst({
        where: { externalStoreId: trimmed },
        include: {
          stores: {
            where: { archivedAt: null, isActive: true },
            include: {
              storeMaster: {
                select: {
                  externalStoreId: true,
                  googleMapsUrl: true,
                  province: true,
                  region: true,
                },
              },
            },
            take: 1,
          },
        },
      });
      if (storeMaster?.stores[0]) {
        store = storeMaster.stores[0];
      }
    }

    if (!store) {
      throw new NotFoundException(`Store not found: ${trimmed}`);
    }

    return store;
  }

  // ==========================================
  // Monthly Batch Audit Session Orchestration
  // ==========================================

  async startMonthlyAudit(
    dto: StartMonthlyAuditDto,
    user?: AuthUser,
  ): Promise<GoogleReviewAuditSessionResponse> {
    const month = dto.month.trim();
    if (!MONTH_REGEX.test(month)) {
      throw new BadRequestException("month must be in YYYY-MM format (e.g. 2026-08)");
    }

    // 1. If an active session (RUNNING or PAUSED) exists, reuse it
    const existing = await this.prisma.googleReviewAuditSession.findFirst({
      where: {
        month,
        status: { in: [GoogleReviewAuditSessionStatus.RUNNING, GoogleReviewAuditSessionStatus.PAUSED] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (existing) {
      this.logger.log(`Reusing active audit session id=${existing.id} for month=${month}`);
      const active = await this.getActiveAuditSession(month);
      if (active) return active;
    }

    // 2. Query all active stores
    const stores = await this.prisma.store.findMany({
      where: {
        archivedAt: null,
        isActive: true,
      },
      orderBy: [{ region: "asc" }, { name: "asc" }],
      include: {
        storeMaster: {
          select: {
            externalStoreId: true,
            googleMapsUrl: true,
            region: true,
          },
        },
      },
    });

    const scope = dto.scope || "ALL_ELIGIBLE";
    let targetStores = stores;

    if (scope === "SELECTED") {
      if (!dto.storeIds || dto.storeIds.length === 0) {
        throw new BadRequestException("At least one storeId must be provided when scope is SELECTED.");
      }
      const uniqueStoreIds = Array.from(new Set(dto.storeIds));
      targetStores = stores.filter((s) => uniqueStoreIds.includes(s.id));
      if (targetStores.length === 0) {
        throw new BadRequestException("None of the selected store IDs were found or active.");
      }
    }

    const eligibleStores = targetStores.filter((s) => {
      const url = s.storeMaster?.googleMapsUrl?.trim();
      return !!url && (url.startsWith("http://") || url.startsWith("https://"));
    });

    if (eligibleStores.length === 0) {
      if (scope === "SELECTED") {
        throw new BadRequestException("None of the selected stores have valid Google Maps URLs configured.");
      }
      throw new BadRequestException("No stores with valid Google Maps URLs found.");
    }

    // 3. Create session with ordered queue items
    const session = await this.prisma.googleReviewAuditSession.create({
      data: {
        month,
        status: GoogleReviewAuditSessionStatus.RUNNING,
        qualificationRuleVersion: dto.qualificationRuleVersion || "IMAGE_CAPTURE_MONTH_V1",
        totalStores: eligibleStores.length,
        startedByUserId: user?.id ?? null,
        queueStores: {
          create: eligibleStores.map((s, idx) => ({
            storeId: s.id,
            queueOrder: idx + 1,
            status: GoogleReviewAuditStoreStatus.PENDING,
          })),
        },
      },
    });

    this.logger.log(
      `Created monthly batch audit session id=${session.id} month=${month} eligibleStores=${eligibleStores.length}/${stores.length}`,
    );

    // Automatically claim the first pending store so currentStore is immediately populated
    await this.getNextPendingStore(session.id);

    const active = await this.getActiveAuditSession(month);
    if (!active) {
      throw new BadRequestException("Failed to retrieve created audit session");
    }
    return active;
  }

  async getActiveAuditSession(month?: string): Promise<GoogleReviewAuditSessionResponse | null> {
    const targetMonth = month?.trim();
    const session = await this.prisma.googleReviewAuditSession.findFirst({
      where: targetMonth ? { month: targetMonth } : undefined,
      orderBy: { createdAt: "desc" },
      include: {
        queueStores: {
          orderBy: { queueOrder: "asc" },
          include: {
            store: {
              include: {
                storeMaster: {
                  select: {
                    externalStoreId: true,
                    googleMapsUrl: true,
                    region: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) return null;

    const totalActiveStores = await this.prisma.store.count({
      where: { archivedAt: null, isActive: true },
    });
    const missingMapsUrlCount = Math.max(0, totalActiveStores - session.totalStores);

    let pendingCount = 0;
    let runningCount = 0;
    let completedCount = 0;
    let needsAttentionCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    let currentStore: GoogleReviewAuditQueueStoreItem | null = null;

    const formattedStores: GoogleReviewAuditQueueStoreItem[] = session.queueStores.map((qs) => {
      if (qs.status === GoogleReviewAuditStoreStatus.PENDING) pendingCount++;
      else if (qs.status === GoogleReviewAuditStoreStatus.RUNNING) {
        runningCount++;
        if (!currentStore) {
          currentStore = {
            id: qs.id,
            sessionId: qs.sessionId,
            storeId: qs.storeId,
            storeName: qs.store.name,
            storeCode: qs.store.code,
            region: qs.store.storeMaster?.region ?? qs.store.region ?? null,
            googleMapsUrl: qs.store.storeMaster?.googleMapsUrl ?? null,
            queueOrder: qs.queueOrder,
            status: qs.status,
            reviewsChecked: qs.reviewsChecked,
            reviewsWithPhoto: qs.reviewsWithPhoto,
            photoReviewsInTargetMonth: qs.photoReviewsInTargetMonth,
            reviewsOver15ThaiWords: qs.reviewsOver15ThaiWords,
            qualifiedReviews: qs.qualifiedReviews,
            coverageStatus: qs.coverageStatus,
            attemptCount: qs.attemptCount,
            errorCode: qs.errorCode,
            errorMessage: qs.errorMessage,
            startedAt: qs.startedAt?.toISOString() ?? null,
            completedAt: qs.completedAt?.toISOString() ?? null,
          };
        }
      } else if (qs.status === GoogleReviewAuditStoreStatus.COMPLETED) completedCount++;
      else if (qs.status === GoogleReviewAuditStoreStatus.NEEDS_ATTENTION) needsAttentionCount++;
      else if (qs.status === GoogleReviewAuditStoreStatus.SKIPPED) skippedCount++;
      else if (qs.status === GoogleReviewAuditStoreStatus.FAILED) failedCount++;

      return {
        id: qs.id,
        sessionId: qs.sessionId,
        storeId: qs.storeId,
        storeName: qs.store.name,
        storeCode: qs.store.code,
        region: qs.store.storeMaster?.region ?? qs.store.region ?? null,
        googleMapsUrl: qs.store.storeMaster?.googleMapsUrl ?? null,
        queueOrder: qs.queueOrder,
        status: qs.status,
        reviewsChecked: qs.reviewsChecked,
        reviewsWithPhoto: qs.reviewsWithPhoto,
        photoReviewsInTargetMonth: qs.photoReviewsInTargetMonth,
        reviewsOver15ThaiWords: qs.reviewsOver15ThaiWords,
        qualifiedReviews: qs.qualifiedReviews,
        coverageStatus: qs.coverageStatus,
        attemptCount: qs.attemptCount,
        errorCode: qs.errorCode,
        errorMessage: qs.errorMessage,
        startedAt: qs.startedAt?.toISOString() ?? null,
        completedAt: qs.completedAt?.toISOString() ?? null,
      };
    });

    return {
      id: session.id,
      month: session.month,
      status: session.status,
      qualificationRuleVersion: session.qualificationRuleVersion,
      totalStores: session.totalStores,
      completedStores: completedCount,
      failedStores: failedCount,
      skippedStores: skippedCount,
      pendingStores: pendingCount,
      runningStores: runningCount,
      needsAttentionStores: needsAttentionCount,
      missingMapsUrlCount,
      startedAt: session.startedAt.toISOString(),
      completedAt: session.completedAt?.toISOString() ?? null,
      currentStore,
      stores: formattedStores,
    };
  }

  async updateAuditSessionStatus(
    sessionId: string,
    dto: UpdateAuditSessionStatusDto,
  ): Promise<GoogleReviewAuditSessionResponse> {
    const session = await this.prisma.googleReviewAuditSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) {
      throw new NotFoundException(`Audit session ${sessionId} not found`);
    }

    if (dto.action === "PAUSE") {
      await this.prisma.googleReviewAuditSession.update({
        where: { id: sessionId },
        data: { status: GoogleReviewAuditSessionStatus.PAUSED },
      });
    } else if (dto.action === "RESUME") {
      await this.prisma.googleReviewAuditSession.update({
        where: { id: sessionId },
        data: { status: GoogleReviewAuditSessionStatus.RUNNING },
      });
      // Ensure there is a RUNNING store claimed (claims next pending store if none running)
      await this.getNextPendingStore(sessionId);
    } else if (dto.action === "CANCEL") {
      await this.prisma.googleReviewAuditSession.update({
        where: { id: sessionId },
        data: { status: GoogleReviewAuditSessionStatus.CANCELLED, completedAt: new Date() },
      });
    }

    const updated = await this.getActiveAuditSession(session.month);
    if (!updated) {
      throw new NotFoundException(`Failed to retrieve updated audit session`);
    }
    return updated;
  }

  async getNextPendingStore(
    sessionId: string,
  ): Promise<{
    sessionStatus: GoogleReviewAuditSessionStatus;
    store: GoogleReviewAuditQueueStoreItem | null;
    targetMonth: string;
  }> {
    const session = await this.prisma.googleReviewAuditSession.findUnique({
      where: { id: sessionId },
      include: {
        queueStores: {
          orderBy: { queueOrder: "asc" },
          include: {
            store: {
              include: {
                storeMaster: {
                  select: {
                    externalStoreId: true,
                    googleMapsUrl: true,
                    region: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Audit session ${sessionId} not found`);
    }

    if (session.status !== GoogleReviewAuditSessionStatus.RUNNING) {
      return { sessionStatus: session.status, store: null, targetMonth: session.month };
    }

    // 1. Check if a store is currently RUNNING
    const runningQueue = session.queueStores.find(
      (qs) => qs.status === GoogleReviewAuditStoreStatus.RUNNING,
    );
    if (runningQueue) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      if (runningQueue.startedAt && runningQueue.startedAt < tenMinutesAgo) {
        // Stale run: re-start attempt
        await this.prisma.googleReviewAuditStore.update({
          where: { id: runningQueue.id },
          data: {
            startedAt: new Date(),
            attemptCount: { increment: 1 },
          },
        });
      }
      return {
        sessionStatus: session.status,
        store: this.mapQueueStoreToItem(runningQueue),
        targetMonth: session.month,
      };
    }

    // 2. Find next PENDING store
    const nextPending = session.queueStores.find(
      (qs) => qs.status === GoogleReviewAuditStoreStatus.PENDING,
    );

    if (nextPending) {
      const updated = await this.prisma.googleReviewAuditStore.update({
        where: { id: nextPending.id },
        data: {
          status: GoogleReviewAuditStoreStatus.RUNNING,
          startedAt: new Date(),
          attemptCount: { increment: 1 },
        },
        include: {
          store: {
            include: {
              storeMaster: {
                select: {
                  externalStoreId: true,
                  googleMapsUrl: true,
                  region: true,
                },
              },
            },
          },
        },
      });

      return {
        sessionStatus: session.status,
        store: this.mapQueueStoreToItem(updated),
        targetMonth: session.month,
      };
    }

    // 3. No PENDING stores remain. Check if all are resolved.
    const hasUnresolved = session.queueStores.some(
      (qs) =>
        qs.status === GoogleReviewAuditStoreStatus.PENDING ||
        qs.status === GoogleReviewAuditStoreStatus.RUNNING,
    );

    if (!hasUnresolved) {
      await this.prisma.googleReviewAuditSession.update({
        where: { id: sessionId },
        data: {
          status: GoogleReviewAuditSessionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
      return {
        sessionStatus: GoogleReviewAuditSessionStatus.COMPLETED,
        store: null,
        targetMonth: session.month,
      };
    }

    return { sessionStatus: session.status, store: null, targetMonth: session.month };
  }

  async completeStoreAudit(
    sessionId: string,
    storeId: string,
    dto: CompleteStoreAuditDto,
    user?: AuthUser,
  ) {
    const {
      reviewsChecked,
      reviewsWithPhoto,
      reviewsOver15ThaiWords,
      qualifiedReviews,
      coverageStatus,
    } = dto;

    if (qualifiedReviews > reviewsChecked) {
      throw new BadRequestException(`qualifiedReviews cannot exceed reviewsChecked`);
    }

    const session = await this.prisma.googleReviewAuditSession.findUnique({
      where: { id: sessionId },
      include: {
        queueStores: {
          where: { storeId },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Audit session ${sessionId} not found`);
    }

    const queueStore = session.queueStores[0];
    if (!queueStore) {
      throw new NotFoundException(`Store ${storeId} not in session queue`);
    }

    // Upsert into canonical GoogleReviewKpiResult and update queueStore
    const effectiveCoverage = dto.coverageStatus || dto.auditCoverageStatus;
    const parsedCoverage =
      effectiveCoverage === "OLDER_THAN_TARGET_REACHED"
        ? GoogleReviewAuditCoverageStatus.OLDER_THAN_TARGET_REACHED
        : effectiveCoverage === "END_OF_AVAILABLE_REVIEWS"
          ? GoogleReviewAuditCoverageStatus.END_OF_AVAILABLE_REVIEWS
          : null;

    await this.prisma.$transaction([
      this.prisma.googleReviewAuditStore.update({
        where: { id: queueStore.id },
        data: {
          status: GoogleReviewAuditStoreStatus.COMPLETED,
          reviewsChecked,
          reviewsWithPhoto,
          photoReviewsInTargetMonth: dto.photoReviewsInTargetMonth || 0,
          reviewsOver15ThaiWords,
          qualifiedReviews,
          coverageStatus: parsedCoverage,
          completedAt: new Date(),
          errorCode: null,
          errorMessage: null,
        },
      }),
      this.prisma.googleReviewKpiResult.upsert({
        where: {
          storeId_month: {
            storeId,
            month: session.month,
          },
        },
        update: {
          reviewsChecked,
          reviewsWithPhoto,
          photoReviewsInTargetMonth: dto.photoReviewsInTargetMonth || 0,
          reviewsOver15ThaiWords,
          qualifiedReviews,
          qualificationRuleVersion: dto.qualificationRuleVersion || session.qualificationRuleVersion || "IMAGE_CAPTURE_MONTH_V1",
          checkedAt: new Date(),
          checkedByUserId: user?.id ?? null,
        },
        create: {
          storeId,
          month: session.month,
          reviewsChecked,
          reviewsWithPhoto,
          photoReviewsInTargetMonth: dto.photoReviewsInTargetMonth || 0,
          reviewsOver15ThaiWords,
          qualifiedReviews,
          qualificationRuleVersion: dto.qualificationRuleVersion || session.qualificationRuleVersion || "IMAGE_CAPTURE_MONTH_V1",
          targetQualifiedReviews: 10,
          checkedAt: new Date(),
          checkedByUserId: user?.id ?? null,
        },
      }),
      this.prisma.googleReviewAuditSession.update({
        where: { id: sessionId },
        data: {
          completedStores: { increment: 1 },
        },
      }),
    ]);

    this.logger.log(
      `Store audit completed: storeId=${storeId} month=${session.month} qualified=${qualifiedReviews}/${reviewsChecked}`,
    );

    // Check if session queue has finished
    const remainingPending = await this.prisma.googleReviewAuditStore.count({
      where: {
        sessionId,
        status: {
          in: [GoogleReviewAuditStoreStatus.PENDING, GoogleReviewAuditStoreStatus.RUNNING],
        },
      },
    });

    if (remainingPending === 0) {
      await this.prisma.googleReviewAuditSession.update({
        where: { id: sessionId },
        data: {
          status: GoogleReviewAuditSessionStatus.COMPLETED,
          completedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      storeId,
      remainingPending,
    };
  }

  async flagStoreNeedsAttention(
    sessionId: string,
    storeId: string,
    dto: FailStoreAuditDto,
  ) {
    const queueStore = await this.prisma.googleReviewAuditStore.findFirst({
      where: { sessionId, storeId },
    });
    if (!queueStore) {
      throw new NotFoundException(`Store ${storeId} not in session queue`);
    }

    await this.prisma.googleReviewAuditStore.update({
      where: { id: queueStore.id },
      data: {
        status: GoogleReviewAuditStoreStatus.NEEDS_ATTENTION,
        errorCode: dto.errorCode,
        errorMessage: dto.errorMessage ?? null,
      },
    });

    await this.prisma.googleReviewAuditSession.update({
      where: { id: sessionId },
      data: { failedStores: { increment: 1 } },
    });

    this.logger.warn(
      `Store audit flagged NEEDS_ATTENTION: storeId=${storeId} error=${dto.errorCode}: ${dto.errorMessage}`,
    );

    return { success: true, storeId, status: "NEEDS_ATTENTION" };
  }

  async skipStore(sessionId: string, storeId: string) {
    const queueStore = await this.prisma.googleReviewAuditStore.findFirst({
      where: { sessionId, storeId },
    });
    if (!queueStore) {
      throw new NotFoundException(`Store ${storeId} not in session queue`);
    }

    await this.prisma.googleReviewAuditStore.update({
      where: { id: queueStore.id },
      data: {
        status: GoogleReviewAuditStoreStatus.SKIPPED,
      },
    });

    await this.prisma.googleReviewAuditSession.update({
      where: { id: sessionId },
      data: { skippedStores: { increment: 1 } },
    });

    return { success: true, storeId, status: "SKIPPED" };
  }

  async reRunStore(sessionId: string, storeId: string) {
    const queueStore = await this.prisma.googleReviewAuditStore.findFirst({
      where: { sessionId, storeId },
    });
    if (!queueStore) {
      throw new NotFoundException(`Store ${storeId} not in session queue`);
    }

    await this.prisma.googleReviewAuditStore.update({
      where: { id: queueStore.id },
      data: {
        status: GoogleReviewAuditStoreStatus.PENDING,
        errorCode: null,
        errorMessage: null,
        completedAt: null,
      },
    });

    return { success: true, storeId, status: "PENDING" };
  }

  private mapQueueStoreToItem(qs: any): GoogleReviewAuditQueueStoreItem {
    return {
      id: qs.id,
      sessionId: qs.sessionId,
      storeId: qs.storeId,
      storeName: qs.store?.name ?? "",
      storeCode: qs.store?.code ?? null,
      region: qs.store?.storeMaster?.region ?? qs.store?.region ?? null,
      googleMapsUrl: qs.store?.storeMaster?.googleMapsUrl ?? null,
      queueOrder: qs.queueOrder,
      status: qs.status,
      reviewsChecked: qs.reviewsChecked,
      reviewsWithPhoto: qs.reviewsWithPhoto,
      photoReviewsInTargetMonth: qs.photoReviewsInTargetMonth ?? 0,
      reviewsOver15ThaiWords: qs.reviewsOver15ThaiWords,
      qualifiedReviews: qs.qualifiedReviews,
      coverageStatus: qs.coverageStatus,
      attemptCount: qs.attemptCount,
      errorCode: qs.errorCode,
      errorMessage: qs.errorMessage,
      startedAt: qs.startedAt ? new Date(qs.startedAt).toISOString() : null,
      completedAt: qs.completedAt ? new Date(qs.completedAt).toISOString() : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Batch Runner Token — cross-origin bearer auth for content script API calls
  // ---------------------------------------------------------------------------

  /**
   * Issues a short-lived (30-min) session-scoped Bearer token for the Batch
   * Runner Chrome Extension.  The token is stored in the existing `Session`
   * table as a MOBILE session so it is validated by the existing AuthGuard
   * without any schema migration.
   *
   * Security properties:
   *   - Expires in 30 minutes regardless of audit duration.
   *   - Can only be issued by an authenticated ADMIN/VIEWER user.
   *   - The session (`sessionId`) must exist and be RUNNING or PAUSED.
   *   - Token is never persisted in the extension beyond chrome.storage.local
   *     (volatile — cleared when user clears the session).
   */
  async issueRunnerToken(
    sessionId: string,
    user: AuthUser,
  ): Promise<{ runnerToken: string; expiresAt: string }> {
    const session = await this.prisma.googleReviewAuditSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });
    if (!session) throw new NotFoundException("Audit session not found");
    if (session.status === "CANCELLED" || session.status === "COMPLETED") {
      throw new BadRequestException(
        "Cannot issue runner token for a completed or cancelled audit session",
      );
    }

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + RUNNER_TOKEN_TTL_MS);

    await this.prisma.session.create({
      data: {
        tokenHash,
        userId: user.id,
        sessionType: SessionType.MOBILE,
        expiresAt,
      },
    });

    this.logger.log(
      JSON.stringify({
        event: "runner_token_issued",
        sessionId,
        userId: user.id,
        expiresAt,
      }),
    );

    return { runnerToken: rawToken, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Revokes all runner tokens for the given user that were issued as MOBILE
   * sessions with a 30-minute TTL (identified by short expiresAt window).
   * Called when the operator finishes or cancels a batch audit.
   * Safe to call even if tokens have already expired.
   */
  async revokeRunnerToken(userId: string): Promise<void> {
    const cutoff = new Date(Date.now() + RUNNER_TOKEN_TTL_MS + 1000);
    await this.prisma.session.deleteMany({
      where: {
        userId,
        sessionType: SessionType.MOBILE,
        expiresAt: { lte: cutoff },
      },
    });
    this.logger.log(
      JSON.stringify({ event: "runner_token_revoked", userId }),
    );
  }

  // =========================================================================
  // WEEKLY GOOGLE REVIEW KPI METHODS
  // =========================================================================

  /**
   * Syncs the locked 65 Weekly KPI store codes into GoogleReviewWeeklyStoreMembership.
   * Maps store codes to StoreMaster records and reuses/creates 1-to-1 Store entities.
   * Guaranteed zero duplicate Store or StoreMaster rows.
   */
  async syncWeeklyStoreMemberships(): Promise<{
    expectedStoreCount: number;
    matchedStoreMasterCount: number;
    unmatchedStoreCodes: string[];
    duplicateMappings: number;
    storesMissingGoogleMapsUrl: string[];
    syncedMembershipsCount: number;
  }> {
    const expectedCodes = LOCKED_WEEKLY_KPI_STORE_CODES;
    const effectiveFrom = new Date("2026-08-26T00:00:00+07:00");

    const storeMasters = await this.prisma.storeMaster.findMany({
      where: { externalStoreId: { in: [...expectedCodes] } },
    });

    const matchedCodesSet = new Set(storeMasters.map((sm) => sm.externalStoreId));
    const unmatchedStoreCodes = expectedCodes.filter((c) => !matchedCodesSet.has(c));

    const missingMaps: string[] = [];
    let syncedMembershipsCount = 0;

    for (const code of expectedCodes) {
      const master = storeMasters.find((sm) => sm.externalStoreId === code) ?? null;

      let storeId: string | null = null;
      if (master) {
        if (!master.googleMapsUrl || master.googleMapsUrl.trim().length === 0) {
          missingMaps.push(code);
        }

        // Find or create matching Store without duplicating StoreMaster
        let store = await this.prisma.store.findFirst({
          where: {
            OR: [
              { storeMasterId: master.id },
              { code: master.externalStoreId },
            ],
          },
        });

        if (!store) {
          store = await this.prisma.store.create({
            data: {
              name: master.storeName,
              code: master.externalStoreId,
              region: master.region,
              area: master.province,
              storeMasterId: master.id,
              provinceSource: "MASTER",
              regionSource: master.region ? "MASTER" : "PROVINCE_MAPPING",
            },
          });
        } else if (!store.storeMasterId) {
          store = await this.prisma.store.update({
            where: { id: store.id },
            data: {
              storeMasterId: master.id,
              name: master.storeName,
              region: master.region ?? store.region,
              area: master.province ?? store.area,
            },
          });
        }
        storeId = store.id;
      } else {
        missingMaps.push(code);
      }

      // Upsert membership
      const existing = await this.prisma.googleReviewWeeklyStoreMembership.findFirst({
        where: { storeCode: code },
      });

      if (existing) {
        await this.prisma.googleReviewWeeklyStoreMembership.update({
          where: { id: existing.id },
          data: {
            storeId,
            isActive: true,
            effectiveFrom,
          },
        });
      } else {
        await this.prisma.googleReviewWeeklyStoreMembership.create({
          data: {
            storeCode: code,
            storeId,
            isActive: true,
            effectiveFrom,
          },
        });
      }
      syncedMembershipsCount++;
    }

    return {
      expectedStoreCount: expectedCodes.length,
      matchedStoreMasterCount: storeMasters.length,
      unmatchedStoreCodes,
      duplicateMappings: 0,
      storesMissingGoogleMapsUrl: missingMaps,
      syncedMembershipsCount,
    };
  }

  /**
   * Ensures weekly periods are generated and stored in the database.
   */
  async ensureWeeklyPeriods(count = 10): Promise<GoogleReviewWeeklyPeriodItem[]> {
    const definitions = generateWeeklyPeriods(count);
    const results: GoogleReviewWeeklyPeriodItem[] = [];

    for (const def of definitions) {
      const record = await this.prisma.googleReviewWeeklyPeriod.upsert({
        where: { weekNumber: def.weekNumber },
        create: {
          weekNumber: def.weekNumber,
          labelZh: def.labelZh,
          labelTh: def.labelTh,
          label: def.label,
          startDate: def.startDate,
          endDate: def.endDate,
          status: def.status === "CLOSED" ? GoogleReviewPeriodStatus.CLOSED : GoogleReviewPeriodStatus.OPEN,
        },
        update: {
          labelZh: def.labelZh,
          labelTh: def.labelTh,
          label: def.label,
          startDate: def.startDate,
          endDate: def.endDate,
          status: def.status === "CLOSED" ? GoogleReviewPeriodStatus.CLOSED : GoogleReviewPeriodStatus.OPEN,
        },
      });

      results.push({
        id: record.id,
        weekNumber: record.weekNumber,
        labelZh: record.labelZh,
        labelTh: record.labelTh,
        label: record.label,
        startDate: record.startDate.toISOString(),
        endDate: record.endDate.toISOString(),
        status: record.status,
        frozenAt: record.frozenAt?.toISOString() ?? null,
      });
    }

    return results;
  }

  /**
   * Retrieves active Weekly KPI store memberships (65 stores) with StoreMaster metadata.
   */
  async getWeeklyStores(): Promise<GoogleReviewWeeklyStoreItem[]> {
    // Auto-sync if not initialized
    const count = await this.prisma.googleReviewWeeklyStoreMembership.count({
      where: { isActive: true },
    });
    if (count === 0) {
      await this.syncWeeklyStoreMemberships();
    }

    const memberships = await this.prisma.googleReviewWeeklyStoreMembership.findMany({
      where: { isActive: true },
      orderBy: { storeCode: "asc" },
      include: {
        store: {
          include: {
            storeMaster: true,
          },
        },
      },
    });

    // Also get StoreMasters directly for storeCodes where store relation is null
    const allStoreMasters = await this.prisma.storeMaster.findMany({
      where: { externalStoreId: { in: memberships.map((m) => m.storeCode) } },
    });
    const masterMap = new Map(allStoreMasters.map((sm) => [sm.externalStoreId, sm]));

    return memberships.map((m) => {
      const master = m.store?.storeMaster ?? (m.storeCode ? masterMap.get(m.storeCode) : null);
      const googleMapsUrl = master?.googleMapsUrl?.trim() || null;
      return {
        id: m.id,
        storeCode: m.storeCode,
        storeId: m.storeId,
        storeName: master?.storeName ?? m.store?.name ?? `Store ${m.storeCode}`,
        region: master?.region ?? m.store?.region ?? null,
        province: master?.province ?? m.store?.area ?? null,
        googleMapsUrl,
        hasGoogleMaps: Boolean(googleMapsUrl),
        isActive: m.isActive,
        effectiveFrom: m.effectiveFrom.toISOString(),
        effectiveTo: m.effectiveTo?.toISOString() ?? null,
      };
    });
  }

  /**
   * Retrieves available weekly periods with auto-generation.
   */
  async getWeeklyPeriods(): Promise<GoogleReviewWeeklyPeriodItem[]> {
    const currentWeekNumber = resolveWeekNumber();
    const targetCount = Math.max(10, currentWeekNumber + 2);
    return this.ensureWeeklyPeriods(targetCount);
  }

  /**
   * Records or updates a Daily KPI entry for a store.
   * Automatically freezes if past Bangkok 23:59 on the given date, and triggers weekly aggregation.
   */
  async recordDailyKpi(dto: RecordDailyKpiDto): Promise<{
    id: string;
    storeCode: string;
    date: string;
    weekNumber: number;
    qualifiedReviews: number;
    status: string;
  }> {
    const dateParts = dto.date.split("-");
    const year = parseInt(dateParts[0], 10);
    const month = parseInt(dateParts[1], 10);
    const day = parseInt(dateParts[2], 10);
    const dateUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0)); // Bangkok midday approx

    const weekNumber = dto.weekNumber ?? resolveWeekNumber(dateUtc);
    await this.ensureWeeklyPeriods(Math.max(10, weekNumber + 1));

    const weekPeriod = await this.prisma.googleReviewWeeklyPeriod.findUnique({
      where: { weekNumber },
    });

    const store = await this.prisma.store.findFirst({
      where: { code: dto.storeCode },
    });

    // Check freeze status (day freezes at 23:59:59.999 Asia/Bangkok)
    const todayBangkok = getBangkokDateParts(new Date()).dateStr;
    const isPastDay = dto.date < todayBangkok;
    const status = dto.status ?? (isPastDay ? GoogleReviewPeriodStatus.CLOSED : GoogleReviewPeriodStatus.OPEN);
    const frozenAt = status === GoogleReviewPeriodStatus.CLOSED ? new Date() : null;

    const daily = await this.prisma.googleReviewDailyKpi.upsert({
      where: {
        storeCode_date: {
          storeCode: dto.storeCode,
          date: dto.date,
        },
      },
      create: {
        storeCode: dto.storeCode,
        storeId: store?.id ?? null,
        date: dto.date,
        weekPeriodId: weekPeriod?.id ?? null,
        weekNumber,
        storeRating: dto.storeRating ?? null,
        reviewsChecked: dto.reviewsChecked,
        reviewsWithPhoto: dto.reviewsWithPhoto,
        reviewsOver15ThaiWords: dto.reviewsOver15ThaiWords,
        qualifiedReviews: dto.qualifiedReviews,
        status,
        frozenAt,
      },
      update: {
        storeId: store?.id ?? undefined,
        weekPeriodId: weekPeriod?.id ?? undefined,
        weekNumber,
        storeRating: dto.storeRating ?? undefined,
        reviewsChecked: dto.reviewsChecked,
        reviewsWithPhoto: dto.reviewsWithPhoto,
        reviewsOver15ThaiWords: dto.reviewsOver15ThaiWords,
        qualifiedReviews: dto.qualifiedReviews,
        status,
        frozenAt: frozenAt ?? undefined,
      },
    });

    // Aggregate weekly totals
    await this.aggregateWeeklyKpi(weekNumber);

    return {
      id: daily.id,
      storeCode: daily.storeCode,
      date: daily.date,
      weekNumber: daily.weekNumber ?? weekNumber,
      qualifiedReviews: daily.qualifiedReviews,
      status: daily.status,
    };
  }

  /**
   * Aggregates daily KPI records for a specific week into GoogleReviewWeeklyKpi rows.
   * Applies Weekly KPI qualification: storeRating > 4.8.
   */
  async aggregateWeeklyKpi(weekNumber: number): Promise<void> {
    const weekPeriod = await this.prisma.googleReviewWeeklyPeriod.findUnique({
      where: { weekNumber },
    });
    if (!weekPeriod) return;

    const dailyRecords = await this.prisma.googleReviewDailyKpi.findMany({
      where: { weekNumber },
    });

    const storeGroups = new Map<
      string,
      {
        storeCode: string;
        storeId: string | null;
        storeRating: number | null;
        reviewsChecked: number;
        reviewsWithPhoto: number;
        reviewsOver15ThaiWords: number;
        qualifiedReviews: number;
      }
    >();

    for (const d of dailyRecords) {
      const existing = storeGroups.get(d.storeCode) ?? {
        storeCode: d.storeCode,
        storeId: d.storeId,
        storeRating: d.storeRating,
        reviewsChecked: 0,
        reviewsWithPhoto: 0,
        reviewsOver15ThaiWords: 0,
        qualifiedReviews: 0,
      };

      existing.reviewsChecked += d.reviewsChecked;
      existing.reviewsWithPhoto += d.reviewsWithPhoto;
      existing.reviewsOver15ThaiWords += d.reviewsOver15ThaiWords;
      existing.qualifiedReviews += d.qualifiedReviews;
      if (d.storeRating !== null && d.storeRating !== undefined) {
        existing.storeRating = d.storeRating;
      }
      if (!existing.storeId && d.storeId) {
        existing.storeId = d.storeId;
      }
      storeGroups.set(d.storeCode, existing);
    }

    const aggregatedList = Array.from(storeGroups.values());

    // Sort: rating > 4.8 first, then qualifiedReviews desc, then storeCode asc
    aggregatedList.sort((a, b) => {
      const aEligible = a.storeRating !== null ? a.storeRating > 4.8 : true;
      const bEligible = b.storeRating !== null ? b.storeRating > 4.8 : true;
      if (aEligible !== bEligible) return aEligible ? -1 : 1;
      if (b.qualifiedReviews !== a.qualifiedReviews) return b.qualifiedReviews - a.qualifiedReviews;
      return a.storeCode.localeCompare(b.storeCode);
    });

    for (let i = 0; i < aggregatedList.length; i++) {
      const item = aggregatedList[i];
      const rank = i + 1;

      await this.prisma.googleReviewWeeklyKpi.upsert({
        where: {
          weekPeriodId_storeCode: {
            weekPeriodId: weekPeriod.id,
            storeCode: item.storeCode,
          },
        },
        create: {
          weekPeriodId: weekPeriod.id,
          weekNumber,
          storeCode: item.storeCode,
          storeId: item.storeId,
          storeRating: item.storeRating,
          reviewsChecked: item.reviewsChecked,
          reviewsWithPhoto: item.reviewsWithPhoto,
          reviewsOver15ThaiWords: item.reviewsOver15ThaiWords,
          qualifiedReviews: item.qualifiedReviews,
          rank,
          status: weekPeriod.status,
        },
        update: {
          storeId: item.storeId,
          storeRating: item.storeRating,
          reviewsChecked: item.reviewsChecked,
          reviewsWithPhoto: item.reviewsWithPhoto,
          reviewsOver15ThaiWords: item.reviewsOver15ThaiWords,
          qualifiedReviews: item.qualifiedReviews,
          rank,
          status: weekPeriod.status,
        },
      });
    }
  }

  /**
   * Retrieves Weekly Leaderboard / Top Store view for a selected weekNumber.
   */
  async getWeeklyLeaderboard(
    dto: QueryWeeklyLeaderboardDto,
  ): Promise<GoogleReviewWeeklyLeaderboardResponse> {
    const currentWeekNumber = resolveWeekNumber();
    const weekNumber = dto.weekNumber ?? currentWeekNumber;

    const periods = await this.ensureWeeklyPeriods(Math.max(10, weekNumber + 2));
    const period = periods.find((p) => p.weekNumber === weekNumber) ?? periods[0];

    const weeklyStores = await this.getWeeklyStores();

    // Fetch daily records for this week
    const dailyRecords = await this.prisma.googleReviewDailyKpi.findMany({
      where: { weekNumber },
      orderBy: { date: "asc" },
    });

    // Group daily records by storeCode
    const dailyByStore = new Map<string, GoogleReviewDailyBreakdownItem[]>();
    for (const d of dailyRecords) {
      const list = dailyByStore.get(d.storeCode) ?? [];
      list.push({
        date: d.date,
        qualifiedReviews: d.qualifiedReviews,
        reviewsChecked: d.reviewsChecked,
        reviewsWithPhoto: d.reviewsWithPhoto,
        status: d.status,
      });
      dailyByStore.set(d.storeCode, list);
    }

    // Fetch weekly aggregated KPI records
    const weeklyKpiRecords = await this.prisma.googleReviewWeeklyKpi.findMany({
      where: { weekPeriodId: period.id },
    });
    const weeklyMap = new Map(weeklyKpiRecords.map((w) => [w.storeCode, w]));

    let rankedStores: GoogleReviewWeeklyRankItem[] = weeklyStores.map((store) => {
      const weekly = weeklyMap.get(store.storeCode);
      const storeRating = weekly?.storeRating ?? null;
      const isRatingEligible = storeRating !== null ? storeRating > 4.8 : true;
      const qualifiedReviews = weekly?.qualifiedReviews ?? 0;
      const reviewsChecked = weekly?.reviewsChecked ?? 0;
      const reviewsWithPhoto = weekly?.reviewsWithPhoto ?? 0;
      const reviewsOver15ThaiWords = weekly?.reviewsOver15ThaiWords ?? 0;
      const dailyBreakdown = dailyByStore.get(store.storeCode) ?? [];

      return {
        rank: 0,
        storeCode: store.storeCode,
        storeId: store.storeId,
        storeName: store.storeName,
        region: store.region,
        province: store.province,
        googleMapsUrl: store.googleMapsUrl,
        storeRating,
        isRatingEligible,
        qualifiedReviews,
        reviewsChecked,
        reviewsWithPhoto,
        reviewsOver15ThaiWords,
        status: period.status,
        dailyBreakdown,
      };
    });

    // Sort by: rating eligibility, qualifiedReviews desc, storeCode asc
    rankedStores.sort((a, b) => {
      if (a.isRatingEligible !== b.isRatingEligible) return a.isRatingEligible ? -1 : 1;
      if (b.qualifiedReviews !== a.qualifiedReviews) return b.qualifiedReviews - a.qualifiedReviews;
      return a.storeCode.localeCompare(b.storeCode);
    });

    // Assign rank
    rankedStores = rankedStores.map((s, idx) => ({ ...s, rank: idx + 1 }));

    // Apply query filters
    let filteredStores = rankedStores;
    if (dto.search?.trim()) {
      const q = dto.search.trim().toLowerCase();
      filteredStores = filteredStores.filter(
        (s) =>
          s.storeCode.toLowerCase().includes(q) ||
          s.storeName.toLowerCase().includes(q) ||
          (s.region && s.region.toLowerCase().includes(q)) ||
          (s.province && s.province.toLowerCase().includes(q)),
      );
    }
    if (dto.region?.trim() && dto.region !== "ALL") {
      filteredStores = filteredStores.filter((s) => s.region === dto.region);
    }
    if (dto.minRating !== undefined) {
      filteredStores = filteredStores.filter(
        (s) => s.storeRating !== null && s.storeRating >= dto.minRating!,
      );
    }

    const totalStores = rankedStores.length;
    const eligibleRatingStores = rankedStores.filter((s) => s.isRatingEligible).length;
    const totalQualifiedReviews = rankedStores.reduce((acc, s) => acc + s.qualifiedReviews, 0);
    const topStore = rankedStores.length > 0 ? rankedStores[0] : null;

    return {
      weekNumber,
      period,
      totalStores,
      eligibleRatingStores,
      totalQualifiedReviews,
      topStore,
      stores: filteredStores,
    };
  }

  /**
   * Retrieves status of the Daily Continuous Weekly Collector.
   */
  async getWeeklyCollectorStatus(): Promise<GoogleReviewWeeklyCollectorStatusResponse> {
    const activeWeekNumber = resolveWeekNumber();
    const dateParts = getBangkokDateParts(new Date());
    const todayBangkok = `${dateParts.year}-${String(dateParts.month).padStart(2, "0")}-${String(dateParts.day).padStart(2, "0")}`;

    const totalStores = await this.prisma.googleReviewWeeklyStoreMembership.count({
      where: { isActive: true },
    });

    const fingerprintsTracked = await this.prisma.googleReviewFingerprint.count();

    const latestFingerprint = await this.prisma.googleReviewFingerprint.findFirst({
      orderBy: { createdAt: "desc" },
    });

    // Today's daily qualified reviews sum
    const todayDailySum = await this.prisma.googleReviewDailyKpi.aggregate({
      where: { date: todayBangkok },
      _sum: { qualifiedReviews: true },
    });

    // Count new fingerprints created today
    const newFingerprintsToday = await this.prisma.googleReviewFingerprint.count({
      where: { reviewDate: todayBangkok },
    });

    return {
      activeWeekNumber,
      todayBangkok,
      totalStores,
      fingerprintsTracked,
      lastRunAt: latestFingerprint?.createdAt?.toISOString() ?? null,
      isRunning: false,
      status: "COMPLETED",
      summaryToday: {
        totalQualifiedToday: todayDailySum._sum.qualifiedReviews ?? 0,
        newReviewsDiscoveredToday: newFingerprintsToday,
      },
    };
  }
}

