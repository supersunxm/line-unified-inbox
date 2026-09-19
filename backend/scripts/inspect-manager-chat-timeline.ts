import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { LineChatNicknameWorkerModule } from "../src/line-chat/line-chat-nickname-worker.module";
import { LineChatManagerMessageRelayWorkerService } from "../src/line-chat/line-chat-manager-message-relay-worker.service";

async function main(): Promise<void> {
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
  const conversationIds = (process.env.LINE_CHAT_TIMELINE_DIAGNOSTIC_CONVERSATION_IDS
    || process.env.LINE_CHAT_TIMELINE_DIAGNOSTIC_CONVERSATION_ID
    || "")
    .split("|")
    .map((value) => value.trim())
    .filter(Boolean);
  if (conversationIds.length === 0) throw new Error("MISSING_CONVERSATION_ID");

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const relay = app.get(LineChatManagerMessageRelayWorkerService);
    for (const conversationId of conversationIds) {
      const result = await relay.inspectVisibleChatTimeline({ conversationId });
      console.log(JSON.stringify({
        event: "line_chat_manager_timeline_diagnostic",
        conversationId,
        result,
      }));
    }
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(JSON.stringify({
    event: "line_chat_manager_timeline_diagnostic_fatal",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
