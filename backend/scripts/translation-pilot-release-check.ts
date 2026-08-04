import { readdir } from "node:fs/promises";
import { loadEnvFile } from "node:process";
import { join } from "node:path";
import { HealthController } from "../src/health.controller";
import { PrismaService } from "../src/prisma.service";
import { runTranslationPilotReleaseCheck } from "../src/translation/translation-pilot-release-check";

try { loadEnvFile(".env"); } catch { /* Managed runtimes may inject configuration directly. */ }

const failedResult = {
  releaseReady: false,
  checks: { configuration: false, runtime: false, database: false, glossary: false },
};

async function main() {
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const health = new HealthController(prisma);
    const result = await runTranslationPilotReleaseCheck(
      process.env,
      process.argv.slice(2),
      {
        healthReady: async () => {
          const healthResult = health.health();
          const readinessResult = await health.readiness();
          return healthResult.status === "ok" && readinessResult.status === "ready";
        },
        currentMigrationNames: async () => {
          const entries = await readdir(join(process.cwd(), "prisma/migrations"), { withFileTypes: true });
          return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
        },
        appliedMigrationNames: async () => {
          const rows = await prisma.$queryRaw<Array<{ migration_name: string }>>`
            SELECT "migration_name"
            FROM "_prisma_migrations"
            WHERE "finished_at" IS NOT NULL AND "rolled_back_at" IS NULL
          `;
          return rows.map((row) => row.migration_name);
        },
      },
    );
    console.log(JSON.stringify(result));
    if (!result.releaseReady) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  console.log(JSON.stringify(failedResult));
  process.exitCode = 1;
});
