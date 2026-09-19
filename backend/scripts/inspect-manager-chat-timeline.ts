import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { LineChatNicknameWorkerModule } from "../src/line-chat/line-chat-nickname-worker.module";
import { LineChatManagerMessageRelayWorkerService } from "../src/line-chat/line-chat-manager-message-relay-worker.service";

async function main(): Promise<void> {
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
  const conversationId = process.env.LINE_CHAT_TIMELINE_DIAGNOSTIC_CONVERSATION_ID?.trim() || "";
  if (!conversationId) throw new Error("MISSING_CONVERSATION_ID");

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const relay = app.get(LineChatManagerMessageRelayWorkerService);
    const result = await relay.inspectVisibleChatTimeline({ conversationId });
    console.log(JSON.stringify({
      event: "line_chat_manager_timeline_diagnostic",
      conversationId,
      result,
    }));
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
