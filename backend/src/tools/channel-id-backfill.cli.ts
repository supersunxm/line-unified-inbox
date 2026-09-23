// One-off production backfill. Safe to rerun: only fills missing channelId values.
import { PrismaClient } from "@prisma/client";
import { CredentialEncryptionService } from "../credentials/credential-encryption.service";

type FailureReason =
  | "NO_TOKEN"
  | "DECRYPT_FAILED"
  | "VERIFY_REJECTED"
  | "INVALID_CLIENT_ID"
  | "DUPLICATE_CHANNEL_ID"
  | "CONCURRENTLY_CHANGED"
  | "UNEXPECTED_ERROR";

type Failure = {
  storeId: string;
  storeName: string;
  basicId: string;
  reason: FailureReason;
};

const prisma = new PrismaClient();
const encryption = new CredentialEncryptionService();
encryption.onModuleInit();

function storeIdentity(item: {
  name: string;
  basicId: string | null;
  store: { name: string; code: string | null; storeMaster: { externalStoreId: string | null } | null } | null;
}) {
  return {
    storeId: item.store?.storeMaster?.externalStoreId ?? item.store?.code ?? "",
    storeName: item.store?.name ?? item.name,
    basicId: item.basicId ?? "",
  };
}

async function verifyShortOrLongLived(token: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const body = new URLSearchParams({ access_token: token });
    const response = await fetch("https://api.line.me/v2/oauth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { client_id?: unknown };
    return typeof json.client_id === "string" ? json.client_id.trim() : null;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyV21(token: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const url = new URL("https://api.line.me/oauth2/v2.1/verify");
    url.searchParams.set("access_token", token);
    const response = await fetch(url, { method: "GET", signal: controller.signal });
    if (!response.ok) return null;
    const json = (await response.json()) as { client_id?: unknown };
    return typeof json.client_id === "string" ? json.client_id.trim() : null;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyToken(token: string): Promise<string | null> {
  const primary = await verifyShortOrLongLived(token).catch(() => null);
  if (primary) return primary;
  return verifyV21(token).catch(() => null);
}

async function main() {
  const activeWhere = {
    accountType: "STORE" as const,
    isActive: true,
    archivedAt: null,
    store: { archivedAt: null },
  };

  const totalActive = await prisma.lineOfficialAccount.count({ where: activeWhere });
  const missing = await prisma.lineOfficialAccount.findMany({
    where: {
      ...activeWhere,
      OR: [{ channelId: null }, { channelId: "" }],
    },
    select: {
      id: true,
      name: true,
      basicId: true,
      channelId: true,
      encryptedChannelAccessToken: true,
      store: {
        select: {
          name: true,
          code: true,
          storeMaster: { select: { externalStoreId: true } },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  const failures: Failure[] = [];
  let tokensAvailable = 0;
  let verificationSuccesses = 0;
  let rowsUpdated = 0;

  const worker = async (item: (typeof missing)[number]) => {
    const identity = storeIdentity(item);
    if (!item.encryptedChannelAccessToken) {
      failures.push({ ...identity, reason: "NO_TOKEN" });
      return;
    }
    tokensAvailable += 1;

    let token: string;
    try {
      token = encryption.decrypt(item.encryptedChannelAccessToken);
    } catch {
      failures.push({ ...identity, reason: "DECRYPT_FAILED" });
      return;
    }

    try {
      const channelId = await verifyToken(token);
      token = "";
      if (!channelId) {
        failures.push({ ...identity, reason: "VERIFY_REJECTED" });
        return;
      }
      if (!/^\d{5,30}$/.test(channelId)) {
        failures.push({ ...identity, reason: "INVALID_CLIENT_ID" });
        return;
      }

      verificationSuccesses += 1;

      const duplicate = await prisma.lineOfficialAccount.findFirst({
        where: {
          id: { not: item.id },
          channelId,
          accountType: "STORE",
          isActive: true,
          archivedAt: null,
        },
        select: { id: true },
      });
      if (duplicate) {
        failures.push({ ...identity, reason: "DUPLICATE_CHANNEL_ID" });
        return;
      }

      const updated = await prisma.lineOfficialAccount.updateMany({
        where: {
          id: item.id,
          OR: [{ channelId: null }, { channelId: "" }],
        },
        data: { channelId },
      });
      if (updated.count === 1) rowsUpdated += 1;
      else failures.push({ ...identity, reason: "CONCURRENTLY_CHANGED" });
    } catch {
      failures.push({ ...identity, reason: "UNEXPECTED_ERROR" });
    }
  };

  const concurrency = 6;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const index = cursor++;
        if (index >= missing.length) return;
        await worker(missing[index]);
      }
    }),
  );

  const remainingMissing = await prisma.lineOfficialAccount.count({
    where: {
      ...activeWhere,
      OR: [{ channelId: null }, { channelId: "" }],
    },
  });

  const result = {
    totalActiveStoreOas: totalActive,
    initiallyMissingChannelId: missing.length,
    tokensAvailable,
    verificationSuccesses,
    rowsUpdated,
    remainingMissingChannelId: remainingMissing,
    failures,
  };
  console.log("CHANNEL_ID_BACKFILL_RESULT=" + JSON.stringify(result));
  if (remainingMissing > 0) process.exitCode = 2;
}

main()
  .catch(() => {
    console.error(JSON.stringify({ fatal: "CHANNEL_ID_BACKFILL_FAILED" }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
