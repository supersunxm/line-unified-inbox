import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SafeMessageResult = {
  id: string;
  createdAt: Date;
  direction: string;
  messageType: string;
  originalTextLength: number;
  translatedEnglishIsNull: boolean;
  translatedChineseIsNull: boolean;
};

async function main() {
  const cutoff = new Date(Date.now() - 15 * 60 * 1000);
  const [message] = await prisma.$queryRaw<SafeMessageResult[]>`
    SELECT
      "id",
      "createdAt",
      "direction"::text AS "direction",
      "messageType"::text AS "messageType",
      char_length("originalText")::int AS "originalTextLength",
      ("translatedEnglish" IS NULL) AS "translatedEnglishIsNull",
      ("translatedChinese" IS NULL) AS "translatedChineseIsNull"
    FROM "Message"
    WHERE "direction" = 'INBOUND'::"MessageDirection"
      AND "messageType" = 'TEXT'::"MessageType"
      AND "createdAt" >= ${cutoff}
    ORDER BY "createdAt" DESC
    LIMIT 1
  `;

  console.log(JSON.stringify(message ?? null));
}

void main()
  .catch(() => {
    console.error("QUERY_FAILED");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
