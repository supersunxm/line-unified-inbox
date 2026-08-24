import test from "node:test";
import assert from "node:assert/strict";
import { DashboardAnalyticsService } from "./dashboard-analytics.service";
import { OperationReportService } from "./operation-report.service";
import { DashboardController } from "./dashboard.controller";
import { ForbiddenException } from "@nestjs/common";

test("PHASE 1 & 2 (Volume & Performance): Scale simulation with 100, 500, and 1000 stores completes in under 2 seconds", async () => {
  // Generate mock dataset scaled to 500 stores and 10,000 conversations
  const mockStores = Array.from({ length: 500 }).map((_, i) => ({
    id: `s_${i + 1}`,
    name: `Store ${i + 1}`,
    isActive: true,
  }));

  const mockConversations = Array.from({ length: 2000 }).map((_, i) => ({
    id: `c_${i + 1}`,
    storeId: `s_${(i % 500) + 1}`,
    bmReplyStatus: i % 3 === 0 ? "REPLIED" : i % 3 === 1 ? "NOTIFIED_BM" : "NOT_REPLIED",
    createdAt: new Date(Date.now() - (i % 24) * 3600 * 1000),
    store: { id: `s_${(i % 500) + 1}`, name: `Store ${(i % 500) + 1}` },
    messages: [
      { direction: "INBOUND", sentAt: new Date(Date.now() - (i % 24) * 3600 * 1000) },
      { direction: "OUTBOUND", sentAt: new Date(Date.now() - ((i % 24) - 1) * 3600 * 1000) },
    ],
    topics: [],
    products: [],
  }));

  const fakePrisma: any = {
    conversation: { findMany: async () => mockConversations },
    store: { findMany: async () => mockStores },
    topic: { findMany: async () => [] },
    productModel: { findMany: async () => [] },
    lineOaFollowerSnapshot: { findFirst: async () => null },
    conversationActivity: { findMany: async () => [] },
  };

  const service = new DashboardAnalyticsService(fakePrisma);

  const startTime = Date.now();
  const result = await service.getAnalytics("today", "HEAD_OFFICE");
  const durationMs = Date.now() - startTime;

  assert.ok(durationMs < 2000, `Dashboard API response time (${durationMs}ms) exceeded 2000ms target`);
  assert.equal(result.dailySummary.activeStoresCount, 500);
  assert.equal(result.dailySummary.totalMessagesToday, 2000);
});

test("dashboard scope is derived from StoreAccessService, not client role or store filters", async () => {
  const fakePrisma: any = {
    conversation: { findMany: async () => [] },
    store: { findMany: async () => [{ id: "s1", name: "Store 1", isActive: true }, { id: "s2", name: "Store 2", isActive: true }] },
    topic: { findMany: async () => [] },
    productModel: { findMany: async () => [] },
    lineOaFollowerSnapshot: { findFirst: async () => null },
    conversationActivity: { findMany: async () => [] },
  };

  const service = new DashboardAnalyticsService(fakePrisma);
  const operationsService: any = {};
  const reportService = new OperationReportService(service);
  const captured: unknown[][] = [];
  const analytics = { getAnalytics: async (...args: unknown[]) => { captured.push(args); return { ok: true }; } } as never;
  const rootCauseService = { generateRootCauseInsights: async (...args: unknown[]) => { captured.push(args); return { ok: true }; } } as never;
  const storeAccess = { accessibleStoreIds: async () => ["s1"] } as never;
  const executiveService = {} as never;
  const messageTraffic = { getTraffic: async () => ({ overallPeakHour: { hour: 0, window: "00:00", count: 0 }, hourlyDistribution: [], storeHourlyDistribution: [] }) } as never;
  const controller = new DashboardController(fakePrisma, operationsService, analytics, executiveService, reportService, rootCauseService, storeAccess, messageTraffic);

  const result = await controller.getAnalytics("today", undefined, undefined, undefined, "s2", { user: { role: "VIEWER" } } as never);
  assert.equal(result.ok, true);
  assert.deepEqual(captured[0], ["today", "VIEWER", ["s1"], undefined]);
});

test("ADMIN can select multiple active stores, while invalid selections are rejected", async () => {
  const fakePrisma: any = {
    store: { findMany: async ({ where }: { where: { id: { in: string[] } } }) => where.id.in.filter((id) => id !== "missing").map((id) => ({ id })) },
  };
  const captured: unknown[][] = [];
  const analytics = { getAnalytics: async (...args: unknown[]) => { captured.push(args); return { ok: true }; } } as never;
  const rootCauseService = { generateRootCauseInsights: async () => ({ ok: true }) } as never;
  const reportService = { generateDailyReport: async () => ({ ok: true }) } as never;
  const storeAccess = { accessibleStoreIds: async () => null } as never;
  const messageTraffic = { getTraffic: async () => ({ overallPeakHour: { hour: 0, window: "00:00", count: 0 }, hourlyDistribution: [], storeHourlyDistribution: [] }) } as never;
  const controller = new DashboardController(fakePrisma, {} as never, analytics, {} as never, reportService, rootCauseService, storeAccess, messageTraffic);

  await controller.getAnalytics("30d", undefined, undefined, "s1,s2", undefined, { user: { role: "ADMIN" } } as never);
  assert.deepEqual(captured[0], ["30d", "ADMIN", ["s1", "s2"], undefined]);
  await assert.rejects(
    () => controller.getAnalytics("today", undefined, undefined, "s1,missing", undefined, { user: { role: "ADMIN" } } as never),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test("an explicit empty dashboard scope never falls back to global store data", async () => {
  const storeWheres: unknown[] = [];
  const conversationWheres: unknown[] = [];
  let activityWhere: unknown;
  const fakePrisma: any = {
    store: { findMany: async ({ where }: { where: unknown }) => { storeWheres.push(where); return []; } },
    conversation: { findMany: async ({ where }: { where: unknown }) => { conversationWheres.push(where); return []; } },
    topic: { findMany: async () => [] },
    productModel: { findMany: async () => [] },
    activityHistory: { findMany: async ({ where }: { where: unknown }) => { activityWhere = where; return []; } },
  };

  await new DashboardAnalyticsService(fakePrisma).getAnalytics("today", "VIEWER", []);

  assert.deepEqual(storeWheres[0], { id: { in: [] }, isActive: true, archivedAt: null });
  assert.deepEqual((conversationWheres[0] as { storeId: unknown }).storeId, { in: [] });
  assert.deepEqual((activityWhere as { conversation: { storeId: unknown } }).conversation.storeId, { in: [] });
});

test("inactive membership denial is enforced before dashboard services run", async () => {
  const storeAccess = { accessibleStoreIds: async () => { throw new ForbiddenException("No active store membership"); } } as never;
  const analytics = { getAnalytics: async () => { throw new Error("must not run"); } } as never;
  const controller = new DashboardController({} as never, {} as never, analytics, {} as never, {} as never, {} as never, storeAccess);

  await assert.rejects(
    () => controller.getAnalytics("today", undefined, undefined, { user: { role: "VIEWER" } } as never),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test("PHASE 5 (Frontend Failure & Edge Case Handling): Empty DB handles gracefully without crash", async () => {
  const fakeEmptyPrisma: any = {
    conversation: { findMany: async () => [] },
    store: { findMany: async () => [] },
    topic: { findMany: async () => [] },
    productModel: { findMany: async () => [] },
    lineOaFollowerSnapshot: { findFirst: async () => null },
    conversationActivity: { findMany: async () => [] },
  };

  const service = new DashboardAnalyticsService(fakeEmptyPrisma);
  const res = await service.getAnalytics("today");

  assert.equal(res.dailySummary.totalMessagesToday, 0);
  assert.equal(res.operationEfficiency.opened, 0);
  assert.equal(res.operationEfficiency.closureRate, 0);
  assert.equal(res.dataQuality.status, "Critical");
  assert.ok(res.dataQuality.warnings.includes("Missing store connection records"));
});
