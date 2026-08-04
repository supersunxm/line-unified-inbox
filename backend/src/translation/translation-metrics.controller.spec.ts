import assert from "node:assert/strict";
import test from "node:test";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { REQUIRED_ROLES } from "../auth/auth.decorators";
import { AuthGuard, AuthUser } from "../auth/auth.guard";
import { TranslationMetrics } from "./translation-metrics";
import { TranslationMetricsController } from "./translation-metrics.controller";
import { TranslationConfig } from "./translation.config";
import { TranslationUsageBudget } from "./translation-usage-budget";
import { TranslationReadinessService } from "./translation-readiness.service";
import { TranslationReportService } from "./translation-report.service";
import { TranslationFeedbackService } from "./translation-feedback";
import { TranslationPilotStatusService } from "./translation-pilot-status.service";

const admin = { id: "admin-1", email: "admin@example.test", displayName: "Admin", role: "ADMIN", isActive: true } as AuthUser;

function authContext(user?: AuthUser, handler: () => unknown = TranslationMetricsController.prototype.getMetrics) {
  const request = { method: "GET", path: "/translation/metrics", headers: {} };
  return {
    getHandler: () => handler,
    getClass: () => TranslationMetricsController,
    switchToHttp: () => ({ getRequest: () => request }),
    request,
    user,
  };
}

function controllerFor(config: TranslationConfig, metrics: TranslationMetrics, budget: TranslationUsageBudget, feedback: TranslationFeedbackService) {
  const readiness = new TranslationReadinessService(config, feedback);
  return new TranslationMetricsController(metrics, budget, readiness, new TranslationReportService(metrics, budget, feedback), feedback, new TranslationPilotStatusService(config, readiness));
}

test("ADMIN can access aggregate translation pilot metrics", async () => {
  const roles = Reflect.getMetadata(REQUIRED_ROLES, TranslationMetricsController.prototype.getMetrics) as string[];
  assert.deepEqual(roles, ["ADMIN"]);
  const context = authContext(admin);
  const guard = new AuthGuard(new Reflector(), { authenticate: async () => admin } as never);
  assert.equal(await guard.canActivate(context as never), true);

  const metrics = new TranslationMetrics();
  metrics.record({ outcome: "SUCCESS", durationMs: 20, characterCount: 12 });
  const config = { dailyCharacterLimit: 50_000 } as TranslationConfig;
  const budget = new TranslationUsageBudget(config);
  const feedback = new TranslationFeedbackService();
  const response = controllerFor(config, metrics, budget, feedback).getMetrics();
  assert.deepEqual(response, {
    totalRequests: 1,
    successfulTranslations: 1,
    failedTranslations: 0,
    providerFailures: 0,
    rateLimitedRequests: 0,
    cacheHits: 0,
    averageDurationMs: 20,
    averageCharacterCount: 12,
    dailyCharacterUsage: 0,
    dailyCharacterLimit: 50_000,
    budgetExceededRequests: 0,
    positiveFeedbackCount: 0,
    terminologyIssueCount: 0,
    meaningIssueCount: 0,
    otherIssueCount: 0,
  });
  assert.ok(Object.values(response).every((value) => typeof value === "number"));
});

test("VIEWER cannot access translation pilot metrics", async () => {
  const viewer = { ...admin, id: "viewer-1", role: "VIEWER" } as AuthUser;
  const context = authContext(viewer);
  const guard = new AuthGuard(new Reflector(), { authenticate: async () => viewer } as never);
  await assert.rejects(guard.canActivate(context as never), ForbiddenException);
});

test("unauthenticated translation metrics request returns 401", async () => {
  const context = authContext();
  const guard = new AuthGuard(new Reflector(), { authenticate: async () => null } as never);
  await assert.rejects(guard.canActivate(context as never), UnauthorizedException);
});

test("translation readiness is ADMIN-only and returns no secret configuration", async () => {
  const roles = Reflect.getMetadata(REQUIRED_ROLES, TranslationMetricsController.prototype.getReadiness) as string[];
  assert.deepEqual(roles, ["ADMIN"]);

  const viewer = { ...admin, id: "viewer-1", role: "VIEWER" } as AuthUser;
  const viewerContext = authContext(viewer, TranslationMetricsController.prototype.getReadiness);
  const viewerGuard = new AuthGuard(new Reflector(), { authenticate: async () => viewer } as never);
  await assert.rejects(viewerGuard.canActivate(viewerContext as never), ForbiddenException);

  const config = {
    enabled: true,
    pilotMode: true,
    allowedAdminIds: ["admin-secret-id"],
    rateLimitPerMinute: 20,
    dailyCharacterLimit: 50_000,
    provider: "google",
    google: { projectId: "secret-project", credentials: { client_email: "secret@example.test", private_key: "secret-key" } },
  } as TranslationConfig;
  const metrics = new TranslationMetrics();
  const budget = new TranslationUsageBudget(config);
  const feedback = new TranslationFeedbackService();
  const controller = controllerFor(config, metrics, budget, feedback);
  const response = controller.getReadiness();
  assert.equal(response.ready, true);
  const serialized = JSON.stringify(response);
  for (const secret of ["admin-secret-id", "secret-project", "secret@example.test", "secret-key"]) assert.equal(serialized.includes(secret), false);
});

test("translation pilot report is ADMIN-only", async () => {
  const roles = Reflect.getMetadata(REQUIRED_ROLES, TranslationMetricsController.prototype.getReport) as string[];
  assert.deepEqual(roles, ["ADMIN"]);
  const adminContext = authContext(admin, TranslationMetricsController.prototype.getReport);
  const adminGuard = new AuthGuard(new Reflector(), { authenticate: async () => admin } as never);
  assert.equal(await adminGuard.canActivate(adminContext as never), true);

  const viewer = { ...admin, id: "viewer-1", role: "VIEWER" } as AuthUser;
  const viewerContext = authContext(viewer, TranslationMetricsController.prototype.getReport);
  const viewerGuard = new AuthGuard(new Reflector(), { authenticate: async () => viewer } as never);
  await assert.rejects(viewerGuard.canActivate(viewerContext as never), ForbiddenException);
});

test("translation pilot status is ADMIN-only and contains safe operational fields", async () => {
  const roles = Reflect.getMetadata(REQUIRED_ROLES, TranslationMetricsController.prototype.getPilotStatus) as string[];
  assert.deepEqual(roles, ["ADMIN"]);
  const adminContext = authContext(admin, TranslationMetricsController.prototype.getPilotStatus);
  const adminGuard = new AuthGuard(new Reflector(), { authenticate: async () => admin } as never);
  assert.equal(await adminGuard.canActivate(adminContext as never), true);

  const viewer = { ...admin, id: "viewer-1", role: "VIEWER" } as AuthUser;
  const viewerContext = authContext(viewer, TranslationMetricsController.prototype.getPilotStatus);
  const viewerGuard = new AuthGuard(new Reflector(), { authenticate: async () => viewer } as never);
  await assert.rejects(viewerGuard.canActivate(viewerContext as never), ForbiddenException);

  const config = {
    enabled: true,
    pilotMode: true,
    allowedAdminIds: ["admin-secret-id"],
    rateLimitPerMinute: 20,
    dailyCharacterLimit: 50_000,
    provider: "google",
    google: { projectId: "secret-project", credentials: { client_email: "secret@example.test", private_key: "secret-key" } },
  } as TranslationConfig;
  const metrics = new TranslationMetrics();
  const budget = new TranslationUsageBudget(config);
  const feedback = new TranslationFeedbackService();
  const response = controllerFor(config, metrics, budget, feedback).getPilotStatus();
  assert.deepEqual(Object.keys(response), ["ready", "active", "allowlistedAdminCount", "rateLimitConfigured", "dailyBudgetConfigured", "feedbackEnabled"]);
  const serialized = JSON.stringify(response);
  for (const secret of ["admin-secret-id", "secret-project", "secret@example.test", "secret-key"]) assert.equal(serialized.includes(secret), false);
});
