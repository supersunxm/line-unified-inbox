import { Test, TestingModule } from "@nestjs/testing";
import { ImpactEngineService } from "./impact-engine.service";
import { ImpactCalculationService } from "./impact-calculation.service";
import { PrismaService } from "../../prisma.service";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";

describe("ImpactEngineService", () => {
  let service: ImpactEngineService;
  let calculationService: ImpactCalculationService;

  const mockPrisma = {
    actionImpactResult: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, evaluatedAt: new Date() })),
    },
  };

  const mockAnalytics = {
    getAnalytics: jest.fn().mockResolvedValue({
      period: "today",
      storeRanking: [{ storeName: "Robinson Chonburi" }],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImpactEngineService,
        ImpactCalculationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DashboardAnalyticsService, useValue: mockAnalytics },
      ],
    }).compile();

    service = module.get<ImpactEngineService>(ImpactEngineService);
    calculationService = module.get<ImpactCalculationService>(ImpactCalculationService);
  });

  it("should calculate impact score and classify effectiveness accurately", () => {
    const res = calculationService.calculateImpact(12, 87, 9, 1, 35, 8);
    expect(res.impactScore).toBeGreaterThanOrEqual(80);
    expect(res.effectiveness).toBe("SUCCESS");
    expect(res.slaImprovementPct).toBe(75);
  });

  it("should generate Action Impact Summary with self-learning patterns", async () => {
    const summary = await service.getActionImpactSummary("today", "HEAD_OFFICE");
    expect(summary).toBeDefined();
    expect(summary.totalEvaluated).toBeGreaterThan(0);
    expect(summary.successRatePct).toBeGreaterThan(0);
    expect(summary.learnedPatterns.length).toBeGreaterThan(0);
  });
});
