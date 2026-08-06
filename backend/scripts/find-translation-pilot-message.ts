import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const message = await prisma.message.findFirst({
    where: {
      originalText: "OPPO Reno16 มีของไหมครับ",
      direction: "INBOUND",
      messageType: "TEXT",
      translatedEnglish: null,
      translatedChinese: null,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      conversationId: true,
    },
  });

  console.log(JSON.stringify(message));
}

void main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
