import assert from "node:assert/strict";
import test from "node:test";
import { Reflector } from "@nestjs/core";
import { HealthController } from "./health.controller";
import { IS_PUBLIC } from "./auth/auth.decorators";
import { PrismaService } from "./prisma.service";

void test("health and readiness endpoints are marked public for Railway healthchecks", () => {
  const reflector = new Reflector();

  const healthPublic = reflector.get<boolean>(IS_PUBLIC, HealthController.prototype.health);
  assert.equal(healthPublic, true, "GET /health must be marked @Public()");

  const readinessPublic = reflector.get<boolean>(IS_PUBLIC, HealthController.prototype.readiness);
  assert.equal(readinessPublic, true, "GET /health/readiness must be marked @Public()");
});

void test("readiness executes SELECT 1 and returns ready when database responds", async () => {
  let executedQuery: unknown = null;
  const mockPrisma: any = {
    $queryRaw: (strings: TemplateStringsArray) => {
      executedQuery = strings.join("");
      return Promise.resolve([{ "?column?": 1 }]);
    },
  };

  const controller = new HealthController(mockPrisma as PrismaService);
  const result = await controller.readiness();

  assert.equal(executedQuery, "SELECT 1");
  assert.deepEqual(result, { status: "ready" });
});

void test("readiness propagates database failure without suppressing errors", async () => {
  const mockPrisma: any = {
    $queryRaw: () => Promise.reject(new Error("Database connection lost")),
  };

  const controller = new HealthController(mockPrisma as PrismaService);
  await assert.rejects(
    () => controller.readiness(),
    (err: any) => err instanceof Error && err.message === "Database connection lost"
  );
});
