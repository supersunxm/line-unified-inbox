import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { LineChatNicknameWorkerModule } from "../src/line-chat/line-chat-nickname-worker.module";
import { PrismaService } from "../src/prisma.service";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";

async function main(): Promise<void> {
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
  const conversationId = process.env.LINE_CHAT_API_DIAGNOSTIC_CONVERSATION_ID?.trim() || "";
  if (!conversationId) throw new Error("MISSING_CONVERSATION_ID");

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn", "log"],
  });
  try {
    const prisma = app.get(PrismaService);
    const sessionService = app.get(LineChatSessionService);
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        lineChatUserId: true,
        lineOfficialAccount: {
          select: {
            chatBotId: true,
            lineChatSession: {
              select: { profilePath: true, profileStorageKey: true },
            },
          },
        },
      },
    });
    if (!conversation?.lineChatUserId) throw new Error("MISSING_LINE_CHAT_USER_ID");
    const botId = conversation.lineOfficialAccount.chatBotId?.trim();
    const session = conversation.lineOfficialAccount.lineChatSession;
    if (!botId || !session) throw new Error("MISSING_MANAGER_CONFIG");
    const profilePath = sessionService.resolveProfilePath(session);

    const result = await sessionService.runDiagnostics({
      profilePath,
      botId,
      lineUserId: conversation.lineChatUserId,
      headless: true,
      surface: "bot",
    });

    console.log(JSON.stringify({
      event: "line_chat_manager_api_diagnostic",
      conversationId,
      observedRequests: result.observedRequests,
      observedResponses: result.observedResponses,
      restApiRequestsObserved: result.restApiRequestsObserved,
      streamingSseObserved: result.streamingSseObserved,
    }));
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(JSON.stringify({
    event: "line_chat_manager_api_diagnostic_fatal",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
