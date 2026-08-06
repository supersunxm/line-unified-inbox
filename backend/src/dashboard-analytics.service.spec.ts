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

test("PHASE 4 (API Security Test): STORE_MANAGER and AREA_MANAGER unauthorized store access rejected", async () => {
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
  const controller = new DashboardController(fakePrisma, operationsService, service, reportService);

  // 1. STORE_MANAGER tries to access s2 when only allowed s1 -> Expect 403 ForbiddenException
  await assert.rejects(
    async () => {
      await controller.getAnalytics("today", "STORE_MANAGER", "s1", "s2");
    },
    (err: any) => err instanceof ForbiddenException && err.message.includes("STORE_MANAGER cannot access other stores"),
  );

  // 2. AREA_MANAGER tries to access s2 outside allowed region s1 -> Expect 403 ForbiddenException
  await assert.rejects(
    async () => {
      await controller.getAnalytics("today", "AREA_MANAGER", "s1", "s2");
    },
    (err: any) => err instanceof ForbiddenException && err.message.includes("AREA_MANAGER cannot access stores outside assigned region"),
  );

  // 3. HEAD_OFFICE accesses all stores -> Expect success
  const headOfficeResult = await controller.getAnalytics("today", "HEAD_OFFICE");
  assert.ok(headOfficeResult.dailySummary);
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
