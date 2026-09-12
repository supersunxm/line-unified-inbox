import { Prisma, PrismaClient } from "@prisma/client";

function argument(name: string): string {
  const prefix = `--${name}=`;
  const value = process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`Missing required ${prefix}<value> argument`);
  return value;
}

async function main() {
  const oaId = argument("oa-id");
  const expectedCurrentStoreCode = argument("current-store-code");
  const targetStoreCode = argument("target-store-code");
  const expectedBasicId = argument("basic-id");
  const apply = process.argv.includes("--apply");
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const oa = await tx.lineOfficialAccount.findUnique({
        where: { id: oaId },
        select: { id: true, name: true, basicId: true, storeId: true, isActive: true, archivedAt: true, store: { select: { code: true } } },
      });
      const targetStore = await tx.store.findUnique({
        where: { code: targetStoreCode },
        select: {
          id: true,
          code: true,
          storeMasterId: true,
          storeMaster: { select: { externalStoreId: true, lineId: true, accountName: true } },
        },
      });
      if (!oa || oa.store?.code !== expectedCurrentStoreCode || oa.basicId?.trim().toLocaleLowerCase("en-US") !== expectedBasicId.toLocaleLowerCase("en-US")) {
        throw new Error("OA no longer matches the reviewed source identity; refusing repair");
      }
      if (!targetStore?.storeMaster || targetStore.storeMaster.externalStoreId !== targetStoreCode || targetStore.storeMaster.lineId?.trim().toLocaleLowerCase("en-US") !== expectedBasicId.toLocaleLowerCase("en-US")) {
        throw new Error("Target Store and StoreMaster no longer match the reviewed identity; refusing repair");
      }
      const activeTargetOas = await tx.lineOfficialAccount.findMany({
        where: { storeId: targetStore.id, accountType: "STORE", isActive: true, archivedAt: null, id: { not: oa.id } },
        select: { id: true },
      });
      if (activeTargetOas.length > 0) throw new Error("Target Store already has another active STORE LINE OA; refusing repair");

      const conversationCount = await tx.conversation.count({ where: { lineOfficialAccountId: oa.id } });
      if (apply) {
        await tx.lineOfficialAccount.update({ where: { id: oa.id }, data: { storeId: targetStore.id } });
        await tx.conversation.updateMany({ where: { lineOfficialAccountId: oa.id }, data: { storeId: targetStore.id } });
      }
      return {
        dryRun: !apply,
        oaId: oa.id,
        accountName: oa.name,
        basicId: oa.basicId,
        currentStoreId: oa.storeId,
        currentStoreCode: oa.store?.code ?? null,
        targetStoreId: targetStore.id,
        targetStoreCode: targetStore.code,
        targetStoreMasterId: targetStore.storeMasterId,
        targetMasterAccountName: targetStore.storeMaster.accountName,
        conversationsToRebind: conversationCount,
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
