import { Test, TestingModule } from "@nestjs/testing";
import { ExecutiveBriefService } from "./executive-brief.service";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";
import { RootCauseService } from "../root-cause.service";
import { RecommendationService } from "../recommendation.service";
import { PrismaService } from "../../prisma.service";

describe("ExecutiveBriefService", () => {
  let service: ExecutiveBriefService;

  const mockDashboardAnalyticsService = {
    getAnalytics: jest.fn().mockResolvedValue({
      period: "today",
      summaryCards: {
        messagesToday: 18420,
        messagesDiffPct: 28,
        pendingCount: 9,
        responseRate24h: 0.82,
      },
      operationHealth: {
        responseRate24h: 0.82,
        totalMessagesToday: 18420,
      },
      peakHourAnalysis: { peakWindow: "18:00 - 22:00" },
      slaRiskPrediction: [
        { storeId: "s1", storeName: "Robinson Chonburi", currentWaitingHours: 2.5, expectedBreachHours: 0.5, riskLevel: "HIGH" },
      ],
      needActionQueue: [
        { storeId: "s1", storeName: "Robinson Chonburi", pending: 9, problem: "9 unanswered conversations", impact: "High customer waiting risk", severity: "HIGH" },
      ],
      topProducts: [{ name: "OPPO Reno 12 Pro" }],
      storeRanking: [],
    }),
  };

  const mockRootCauseService = {
    generateRootCauseInsights: jest.fn().mockResolvedValue({
      summary: "SLA degradation detected mainly from evening peak workload concentration.",
      confidence: 94,
      totalAffectedStores: 1,
      insights: [],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutiveBriefService,
        { provide: DashboardAnalyticsService, useValue: mockDashboardAnalyticsService },
        { provide: RootCauseService, useValue: mockRootCauseService },
        RecommendationService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<ExecutiveBriefService>(ExecutiveBriefService);
  });

  it("should generate deterministic Executive Daily Brief", async () => {
    const brief = await service.generateExecutiveBrief("today", "HEAD_OFFICE");

    expect(brief).toBeDefined();
    expect(brief.overallStatus).toBe("ATTENTION");
    expect(brief.headline).toContain("SLA degradation detected");
    expect(brief.keyHighlights.length).toBeGreaterThan(0);
    expect(brief.criticalIssues.length).toBeGreaterThan(0);
    expect(brief.criticalIssues[0].storeName).toBe("Robinson Chonburi");
    expect(brief.recommendedDecisions.length).toBeGreaterThan(0);
    expect(brief.recommendedDecisions[0].owner).toBe("Area Manager");
    expect(brief.metrics.totalMessages).toBe(18420);
    expect(brief.metrics.slaRate).toBe(82);
  });
});
