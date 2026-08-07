import { Test, TestingModule } from "@nestjs/testing";
import { BiAssistantService } from "./bi-assistant.service";
import { QueryAnalyzerService } from "./query-analyzer.service";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";
import { RootCauseService } from "../root-cause.service";
import { ExecutiveBriefService } from "../executive-brief/executive-brief.service";
import { RecommendationService } from "../recommendation.service";
import { BIQueryIntent } from "./bi-assistant.types";

describe("BiAssistantService", () => {
  let service: BiAssistantService;
  let analyzer: QueryAnalyzerService;

  const mockAnalytics = {
    getAnalytics: jest.fn().mockResolvedValue({
      period: "today",
      summaryCards: { messagesToday: 18420, messagesDiffPct: 28, pendingCount: 9, responseRate24h: 0.82 },
      operationHealth: { responseRate24h: 0.82, totalMessagesToday: 18420 },
      peakHourAnalysis: { peakWindow: "18:00 - 22:00" },
      slaRiskPrediction: [{ storeName: "Robinson Chonburi" }],
      needActionQueue: [{ storeName: "Robinson Chonburi", pending: 9 }],
      topProducts: [{ name: "OPPO Reno 12 Pro" }],
    }),
  };

  const mockRootCause = {
    generateRootCauseInsights: jest.fn().mockResolvedValue({
      summary: "Peak hour message surge",
      confidence: 94,
      totalAffectedStores: 1,
      insights: [{ recommendation: "Assign float backup responder 18:00-22:00" }],
    }),
  };

  const mockBrief = {
    generateExecutiveBrief: jest.fn().mockResolvedValue({
      overallStatus: "ATTENTION",
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiAssistantService,
        QueryAnalyzerService,
        { provide: DashboardAnalyticsService, useValue: mockAnalytics },
        { provide: RootCauseService, useValue: mockRootCause },
        { provide: ExecutiveBriefService, useValue: mockBrief },
        RecommendationService,
      ],
    }).compile();

    service = module.get<BiAssistantService>(BiAssistantService);
    analyzer = module.get<QueryAnalyzerService>(QueryAnalyzerService);
  });

  it("should classify SLA question intent accurately", () => {
    const res = analyzer.analyzeQuery("Why SLA dropped today?");
    expect(res.intent).toBe(BIQueryIntent.SLA_ANALYSIS);
    expect(res.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("should classify Store Risk question intent accurately", () => {
    const res = analyzer.analyzeQuery("Which store needs attention?");
    expect(res.intent).toBe(BIQueryIntent.STORE_RISK);
  });

  it("should synthesize evidence-backed BI answer", async () => {
    const answer = await service.answerQuery("Why SLA dropped today?", "today", "HEAD_OFFICE");

    expect(answer).toBeDefined();
    expect(answer.intent).toBe(BIQueryIntent.SLA_ANALYSIS);
    expect(answer.summary).toContain("SLA");
    expect(answer.evidence.length).toBeGreaterThan(0);
    expect(answer.affectedStores).toContain("Robinson Chonburi");
    expect(answer.confidence).toBeGreaterThanOrEqual(90);
  });
});
