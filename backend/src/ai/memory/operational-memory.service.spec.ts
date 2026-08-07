import { Test, TestingModule } from "@nestjs/testing";
import { OperationalMemoryService } from "./operational-memory.service";
import { PrismaService } from "../../prisma.service";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";

describe("OperationalMemoryService", () => {
  let service: OperationalMemoryService;

  const mockPrisma = {
    operationalMemoryCase: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, lastAppliedAt: new Date() })),
    },
  };

  const mockAnalytics = {
    getAnalytics: jest.fn().mockResolvedValue({
      period: "today",
      storeRanking: [{ storeName: "Robinson Chonburi" }],
      peakHourAnalysis: { peakWindow: "18:00 - 22:00" },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperationalMemoryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DashboardAnalyticsService, useValue: mockAnalytics },
      ],
    }).compile();

    service = module.get<OperationalMemoryService>(OperationalMemoryService);
  });

  it("should retrieve operational memory summary with confidence scores", async () => {
    const summary = await service.getMemorySummary("today", "HEAD_OFFICE");
    expect(summary).toBeDefined();
    expect(summary.totalStoredCases).toBeGreaterThan(0);
    expect(summary.avgConfidencePct).toBeGreaterThanOrEqual(90);
    expect(summary.topSlaLiftCase).toContain("Robinson Chonburi");
  });
});
