import "reflect-metadata";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

interface SetChatUserArgs {
  conversationId: string;
  lineChatUserId: string;
  dryRun: boolean;
}

function parseArgs(args: string[]): SetChatUserArgs {
  let conversationId = "";
  let lineChatUserId = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--pilot") {
      conversationId = "cb6dc791-ef0e-45f0-bb33-96c9b638c9a0";
      lineChatUserId = "Ud8d5af30ddca3ed4237e157d5d73c2f1";
    } else if (arg === "--conversation" || arg === "-c") {
      conversationId = args[++i] || "";
    } else if (arg === "--chat-user-id" || arg === "-u") {
      lineChatUserId = args[++i] || "";
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return { conversationId, lineChatUserId, dryRun };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.conversationId || !args.lineChatUserId) {
    console.error("Usage: tsx scripts/set-conversation-line-chat-user.ts --conversation <id> --chat-user-id <lineChatUserId> [--dry-run]");
    console.error("       tsx scripts/set-conversation-line-chat-user.ts --pilot [--dry-run]");
    process.exit(1);
  }

  console.log("===============================================================");
  console.log(" Set Conversation LINE OA Manager Chat User ID Mapping");
  console.log("===============================================================");
  console.log(` Target Conversation ID : ${args.conversationId}`);
  console.log(` Target LINE Chat User  : ${args.lineChatUserId}`);
  console.log(` Dry Run Mode           : ${args.dryRun ? "YES (No changes will be written)" : "NO (Applying changes)"}`);
  console.log("---------------------------------------------------------------");

  const conversation = await prisma.conversation.findUnique({
    where: { id: args.conversationId },
    include: {
      store: { select: { id: true, name: true, code: true } },
      lineOfficialAccount: { select: { id: true, name: true, chatBotId: true } },
      customer: { select: { id: true, displayName: true, lineUserId: true } },
    },
  });

  if (!conversation) {
    console.error(`❌ Conversation not found: ${args.conversationId}`);
    process.exit(1);
  }

  console.log(` Found Store            : ${conversation.store?.name || "N/A"} (${conversation.store?.code || "N/A"})`);
  console.log(` Found OA               : ${conversation.lineOfficialAccount?.name} (${conversation.lineOfficialAccount?.chatBotId})`);
  console.log(` Customer Display Name  : ${conversation.customer?.displayName}`);
  console.log(` Messaging API User ID  : ${conversation.customer?.lineUserId} (will remain UNTOUCHED)`);
  console.log(` Current lineChatUserId : ${conversation.lineChatUserId || "<none>"}`);

  if (args.dryRun) {
    console.log("\n[DRY-RUN] Validation passed. Run without --dry-run to commit.");
    return;
  }

  const updated = await prisma.conversation.update({
    where: { id: args.conversationId },
    data: { lineChatUserId: args.lineChatUserId },
  });

  console.log(`\n✓ Successfully updated Conversation ${updated.id}`);
  console.log(`  New lineChatUserId : ${updated.lineChatUserId}`);
  console.log("===============================================================");
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error("Fatal error:", err);
      process.exit(1);
    })
    .finally(() => void prisma.$disconnect());
}
