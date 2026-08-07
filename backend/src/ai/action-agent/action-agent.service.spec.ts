import { Test, TestingModule } from "@nestjs/testing";
import { ActionAgentService } from "./action-agent.service";
import { ActionExecutionService } from "./action-execution.service";
import { PrismaService } from "../../prisma.service";
import { DashboardAnalyticsService } from "../../dashboard-analytics.service";
import { RootCauseService } from "../root-cause.service";
import { RecommendationService } from "../recommendation.service";
import { ExecutiveBriefService } from "../executive-brief/executive-brief.service";
import { ActionType } from "./action-agent.types";

describe("ActionAgentService", () => {
  let service: ActionAgentService;

  const mockPrisma = {
    operationalActionTask: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...data, createdAt: new Date() })),
      findUnique: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve({
          id: where.id,
          storeId: "store-chonburi",
          storeName: "Robinson Chonburi",
          problem: "9 unanswered conversations",
          rootCause: "Evening workload surge",
          actionType: "ASSIGN_SUPPORT",
          recommendedAction: "Assign backup responder",
          owner: "Area Manager",
          deadline: "Today 18:00",
          priority: "CRITICAL",
          status: "PENDING_APPROVAL",
          expectedImpact: "Reduce SLA breach by 35%",
          createdAt: new Date(),
        })
      ),
      update: jest.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({
          id: where.id,
          storeId: "store-chonburi",
          storeName: "Robinson Chonburi",
          problem: "9 unanswered conversations",
          rootCause: "Evening workload surge",
          actionType: "ASSIGN_SUPPORT",
          recommendedAction: "Assign backup responder",
          owner: "Area Manager",
          deadline: "Today 18:00",
          priority: "CRITICAL",
          status: data.status,
          expectedImpact: "Reduce SLA breach by 35%",
          createdAt: new Date(),
        })
      ),
    },
  };

  const mockAnalytics = {
    getAnalytics: jest.fn().mockResolvedValue({
      period: "today",
      needActionQueue: [
        { storeId: "store-1", storeName: "Robinson Chonburi", problem: "9 unanswered conversations", pending: 9, impact: "High customer waiting risk", severity: "HIGH" },
      ],
      slaRiskPrediction: [],
      peakHourAnalysis: { peakWindow: "18:00 - 22:00" },
    }),
  };

  const mockRootCause = {
    generateRootCauseInsights: jest.fn().mockResolvedValue({
      insights: [
        { storeName: "Robinson Chonburi", diagnosis: { primaryCause: "Peak hour message surge" } },
      ],
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActionAgentService,
        ActionExecutionService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DashboardAnalyticsService, useValue: mockAnalytics },
        { provide: RootCauseService, useValue: mockRootCause },
        { provide: ExecutiveBriefService, useValue: {} },
        RecommendationService,
      ],
    }).compile();

    service = module.get<ActionAgentService>(ActionAgentService);
  });

  it("should generate dynamic operational action tasks when DB is empty", async () => {
    const tasks = await service.getActionTasks("today", "HEAD_OFFICE");
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].storeName).toBe("Robinson Chonburi");
    expect(tasks[0].actionType).toBe(ActionType.ASSIGN_SUPPORT);
  });

  it("should transition status from PENDING_APPROVAL to APPROVED", async () => {
    const task = await service.approveTask("act-task-1");
    expect(task.status).toBe("APPROVED");
  });

  it("should transition status to COMPLETED", async () => {
    const task = await service.completeTask("act-task-1");
    expect(task.status).toBe("COMPLETED");
  });
});
