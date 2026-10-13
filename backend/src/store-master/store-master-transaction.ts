import { Prisma } from "@prisma/client";

/** Serialize every Store Master apply path without a schema change. */
export async function acquireStoreMasterApplyLock(client: Prisma.TransactionClient): Promise<void> {
  const result = await client.$queryRaw<Array<{ lockResultIsNull: boolean }>>`
    SELECT pg_advisory_xact_lock(1398038354, 1296124756) IS NULL AS "lockResultIsNull"
  `;
  if (result.length !== 1 || typeof result[0]?.lockResultIsNull !== "boolean") {
    throw new Error("Store Master apply advisory lock was not acquired");
  }
}
