import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes } from "node:crypto";

type BackfillClient = Pick<PrismaClient, "$queryRawUnsafe"> & { lineOfficialAccount: Pick<PrismaClient["lineOfficialAccount"], "update"> };

export async function backfillWebhookKeys(client: BackfillClient, generateKey: () => string = () => randomBytes(24).toString("base64url")) {
  const incomplete = await client.$queryRawUnsafe<Array<{ id: string }>>('SELECT "id" FROM "LineOfficialAccount" WHERE "webhookKey" IS NULL OR btrim("webhookKey") = \'\'');
  let repaired = 0;
  for (const { id } of incomplete) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await client.lineOfficialAccount.update({ where: { id }, data: { webhookKey: generateKey() } });
        repaired += 1;
        break;
      } catch (error) {
        const collision = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
        if (!collision || attempt === 2) throw error;
      }
    }
  }
  return { scanned: incomplete.length, repaired };
}
