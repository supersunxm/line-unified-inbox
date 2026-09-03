import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import {
  CheckGoogleReviewKpiResultDto,
  CompleteStoreAuditDto,
  FailStoreAuditDto,
  GoogleReviewAuditQueueStoreItem,
  GoogleReviewAuditSessionResponse,
  GoogleReviewKpiStoreItem,
  GoogleReviewKpiSummary,
  MONTH_REGEX,
  QueryGoogleReviewKpiDto,
  StartMonthlyAuditDto,
  UpdateAuditSessionStatusDto,
} from "./google-review-kpi.dto";
import type { AuthUser } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import {
  GoogleReviewAuditCoverageStatus,
  GoogleReviewAuditSessionStatus,
  GoogleReviewAuditStoreStatus,
} from "@prisma/client";

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
          reviewsOver15ThaiWords: kpiRecord.reviewsOver15ThaiWords,
          qualifiedReviews: kpiRecord.qualifiedReviews,
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
        reviewsOver15ThaiWords,
        qualifiedReviews,
        targetQualifiedReviews,
        checkedAt: new Date(),
        checkedByUserId: user?.id ?? null,
      },
      create: {
        storeId: store.id,
        month: dto.month,
        reviewsChecked,
        reviewsWithPhoto,
        reviewsOver15ThaiWords,
        qualifiedReviews,
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
          reviewsOver15ThaiWords,
          qualifiedReviews,
          checkedAt: new Date(),
          checkedByUserId: user?.id ?? null,
        },
        create: {
          storeId,
          month: session.month,
          reviewsChecked,
          reviewsWithPhoto,
          reviewsOver15ThaiWords,
          qualifiedReviews,
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
}
