import { PrismaClient } from "@prisma/client";
import { execSync } from "child_process";

async function main() {
  let dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes("localhost") || dbUrl.includes("internal")) {
    try {
      const vars = JSON.parse(execSync("railway variables --service Postgres --json").toString());
      if (vars.DATABASE_PUBLIC_URL) {
        dbUrl = vars.DATABASE_PUBLIC_URL;
      }
    } catch {
      // fallback
    }
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: dbUrl } }
  });

  const CANARY_CONVERSATION_ID = "a04560a5-8658-493b-9b18-c992adc2b683";
  const MAX_CONVERSATION_ID = "9cf223e4-194a-47ce-b795-1192a22d3928";
  const TEST_TEXT = "TEST DURABLE VERIFY DELAY 003";

  console.log("=== CANARY 003 VERIFICATION ===");

  try {
    // 1. Target Conversation Status
    const conversation = await prisma.conversation.findUnique({
      where: { id: CANARY_CONVERSATION_ID },
      select: {
        id: true,
        bmReplyStatus: true,
        followUpStatus: true,
        latestMessageAt: true,
        customer: { select: { displayName: true } },
        store: { select: { code: true } },
      },
    });
    console.log("Canary Conversation:", JSON.stringify(conversation, null, 2));

    // 2. Message records matching TEST DURABLE VERIFY DELAY 003
    const messages = await prisma.message.findMany({
      where: {
        conversationId: CANARY_CONVERSATION_ID,
        originalText: TEST_TEXT,
      },
      orderBy: { createdAt: "desc" },
    });
    console.log(`Found ${messages.length} Message row(s) for "${TEST_TEXT}":`);
    for (const msg of messages) {
      console.log(JSON.stringify({
        id: msg.id,
        deliveryStatus: msg.deliveryStatus,
        sentAt: msg.sentAt,
        createdAt: msg.createdAt,
        senderDisplayName: msg.senderDisplayName,
        rawPayload: msg.rawPayload,
      }, null, 2));

      // 3. SendJobs
      const jobs = await prisma.lineChatMessageSendJob.findMany({
        where: { messageId: msg.id },
        include: {
          attempts: {
            orderBy: { attemptNo: "asc" },
          },
        },
      });
      console.log(`  Found ${jobs.length} SendJob(s):`);
      for (const job of jobs) {
        console.log(JSON.stringify({
          id: job.id,
          status: job.status,
          attemptCount: job.attemptCount,
          verifyAttemptCount: job.verifyAttemptCount,
          managerMessageId: job.managerMessageId,
          lastError: job.lastError,
          sendStartedAt: job.sendStartedAt,
          lastVerifiedAt: job.lastVerifiedAt,
          completedAt: job.completedAt,
          createdAt: job.createdAt,
        }, null, 2));

        console.log(`    DeliveryAttempts (${job.attempts.length}):`);
        for (const att of job.attempts) {
          console.log(JSON.stringify({
            id: att.id,
            attemptNo: att.attemptNo,
            status: att.status,
            failureReason: att.failureReason,
            startedAt: att.startedAt,
            sendActionAt: att.sendActionAt,
            verifiedAt: att.verifiedAt,
            finishedAt: att.finishedAt,
            managerMessageId: att.managerMessageId,
          }, null, 2));
        }
      }
    }

    // 4. Any other SendJobs in the last 15 minutes
    const recentJobs = await prisma.lineChatMessageSendJob.findMany({
      where: {
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
        conversationId: { not: CANARY_CONVERSATION_ID },
      },
    });
    console.log(`Other SendJobs created in last 15 mins: ${recentJobs.length}`);

    // 5. Max traffic check
    const maxMessages = await prisma.message.findMany({
      where: {
        conversationId: MAX_CONVERSATION_ID,
        createdAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    console.log(`Max conversation messages in last 15 mins: ${maxMessages.length}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
