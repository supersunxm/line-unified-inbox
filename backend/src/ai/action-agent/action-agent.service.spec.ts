import test from "node:test";
import assert from "node:assert/strict";
import { ActionAgentService } from "./action-agent.service";
import { ActionExecutionService } from "./action-execution.service";
import { AiTelemetryService } from "../telemetry/ai-telemetry.service";
import { ActionType } from "./action-agent.types";

test("ActionAgentService test suite", async (t) => {
  const mockPrisma: any = {
    operationalActionTask: {
      findMany: async () => [],
      create: async ({ data }: any) => ({ ...data, createdAt: new Date() }),
      findUnique: async ({ where }: any) => ({
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
      }),
      update: async ({ where, data }: any) => ({
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
      }),
    },
    actionImpactResult: {
      create: async ({ data }: any) => ({ ...data, id: "imp-1", evaluatedAt: new Date() }),
    },
  };

  const mockAnalytics: any = {
    getAnalytics: async () => ({
      period: "today",
      needActionQueue: [
        { storeId: "store-1", storeName: "Robinson Chonburi", problem: "9 unanswered conversations", pending: 9, impact: "High customer waiting risk", severity: "HIGH" },
      ],
      slaRiskPrediction: [],
      peakHourAnalysis: { peakWindow: "18:00 - 22:00" },
    }),
  };

  const mockRootCause: any = {
    generateRootCauseInsights: async () => ({
      insights: [
        { storeName: "Robinson Chonburi", diagnosis: { primaryCause: "Peak hour message surge" } },
      ],
    }),
  };

  const executionService = new ActionExecutionService();
  const telemetryService = new AiTelemetryService(mockAnalytics);
  const service = new ActionAgentService(
    mockPrisma,
    mockAnalytics,
    mockRootCause,
    executionService,
    telemetryService,
  );

  await t.test("should generate dynamic operational action tasks when DB is empty", async () => {
    const tasks = await service.getActionTasks("today", "HEAD_OFFICE");
    assert.ok(tasks.length > 0);
    assert.equal(tasks[0].storeName, "Robinson Chonburi");
    assert.equal(tasks[0].actionType, ActionType.ASSIGN_SUPPORT);
  });

  await t.test("should transition status from PENDING_APPROVAL to APPROVED", async () => {
    const task = await service.approveTask("act-task-1");
    assert.equal(task.status, "APPROVED");
  });

  await t.test("should transition status to COMPLETED", async () => {
    const task = await service.completeTask("act-task-1");
    assert.equal(task.status, "COMPLETED");
  });
});
