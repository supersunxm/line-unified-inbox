import { UserRole } from "@prisma/client";
import type { AuthUser } from "./auth/auth.guard";
import type { StoreAccessService } from "./auth/store-access.service";
import { HistoricalTimelineService } from "./historical-timeline.service";
import { PrismaService } from "./prisma.service";

function arg(name: string, fallback: string): string {
  const prefix = "--" + name + "=";
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length) ?? fallback;
}

async function main() {
  const dateFrom = arg("date-from", "2026-09-01");
  const dateTo = arg("date-to", "2026-09-28");
  const prisma = new PrismaService();
  await prisma.$connect();

  const storeAccess = {
    accessibleStoreIds: async () => null,
  } as unknown as StoreAccessService;

  const service = new HistoricalTimelineService(prisma, storeAccess);
  const user: AuthUser = {
    id: "reply-kpi-audit",
    email: "reply-kpi-audit@internal.invalid",
    displayName: "Reply KPI Audit",
    role: UserRole.ADMIN,
    isActive: true,
  };

  try {
    const result = await service.replyAnalytics(user, {
      dateFrom,
      dateTo,
      mode: "RESPONSE_CYCLES",
      auditLimit: 0,
    });

    const storesWithCycles = result.stores.filter((store) => store.total > 0);
    const storesWithPending = result.stores.filter((store) => store.pending > 0);
    const storesWithUnknownResponder = result.stores.filter(
      (store) => store.unknownResponderReplies > 0,
    );

    process.stdout.write(JSON.stringify({
      AUDIT_STATUS: "READ_ONLY_COMPLETE",
      DATABASE_WRITES: 0,
      dateFrom,
      dateTo,
      mode: result.mode,
      overview: result.overview,
      responderCoverage: result.responderCoverage,
      sources: result.sources,
      storeDiagnostics: {
        storesWithCycles: storesWithCycles.length,
        storesWithPending: storesWithPending.length,
        storesWithUnknownResponder: storesWithUnknownResponder.length,
      },
      daily: result.dates,
      monthly: result.months,
    }, null, 2) + "\n");
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error) => {
  process.stderr.write(JSON.stringify({
    AUDIT_STATUS: "ERROR",
    DATABASE_WRITES: 0,
    error: error instanceof Error ? error.message : String(error),
  }) + "\n");
  process.exitCode = 1;
});
