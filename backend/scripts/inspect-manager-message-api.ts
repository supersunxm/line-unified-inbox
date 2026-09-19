import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { LineChatNicknameWorkerModule } from "../src/line-chat/line-chat-nickname-worker.module";
import { PrismaService } from "../src/prisma.service";
import { LineChatSessionService } from "../src/line-chat/line-chat-session.service";

function pickMessageFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.slice(-30).map(pickMessageFields);
  if (!value || typeof value !== "object") return value;
  const row = value as Record<string, unknown>;
  const keep = ["id","messageId","sendId","type","source","timestamp","sentAt","createdAt","text","message","bizId","userId","from","to","direction","senderType"];
  const out: Record<string, unknown> = {};
  for (const key of keep) {
    if (key in row) {
      const v = row[key];
      if (key === "text" || key === "message") {
        if (typeof v === "string") out[key] = v.slice(0, 500);
        else out[key] = pickMessageFields(v);
      } else {
        out[key] = typeof v === "object" ? pickMessageFields(v) : v;
      }
    }
  }
  for (const [key, v] of Object.entries(row)) {
    if (!(key in out) && /message|event|list/i.test(key) && typeof v === "object") {
      out[key] = pickMessageFields(v);
    }
  }
  return out;
}

async function main(): Promise<void> {
  process.env.LINE_CHAT_NICKNAME_MAINTENANCE_MODE = "true";
  const conversationIds = (process.env.LINE_CHAT_MESSAGE_API_INSPECT_CONVERSATION_IDS || "")
    .split("|").map(v => v.trim()).filter(Boolean);
  if (conversationIds.length === 0) throw new Error("MISSING_CONVERSATION_IDS");

  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error","warn","log"],
  });
  try {
    const prisma = app.get(PrismaService);
    const sessionService = app.get(LineChatSessionService);
    const conversations = await prisma.conversation.findMany({
      where: { id: { in: conversationIds } },
      select: {
        id: true,
        lineChatUserId: true,
        customer: { select: { displayName: true } },
        lineOfficialAccount: {
          select: {
            chatBotId: true,
            lineChatSession: { select: { profilePath: true, profileStorageKey: true } },
          },
        },
      },
    });
    if (conversations.length === 0) throw new Error("NO_CONVERSATIONS");
    const first = conversations[0];
    const botId = first.lineOfficialAccount.chatBotId?.trim();
    const session = first.lineOfficialAccount.lineChatSession;
    if (!botId || !session) throw new Error("MISSING_MANAGER_CONFIG");
    const profilePath = sessionService.resolveProfilePath(session);
    const context = await sessionService.launchManagedPersistentContext(profilePath, {
      profilePath, headless: true, viewport: { width: 1280, height: 800 },
      args: ["--no-sandbox","--disable-setuid-sandbox","--disable-blink-features=AutomationControlled"],
    });
    try {
      const page = context.pages()[0] || await context.newPage();
      await page.goto(`https://chat.line.biz/${encodeURIComponent(botId)}`, {
        waitUntil: "domcontentloaded", timeout: 15000,
      }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

      for (const conversation of conversations) {
        const lineChatUserId = conversation.lineChatUserId?.trim();
        if (!lineChatUserId) continue;
        const url = `https://chat.line.biz/api/v3/bots/${encodeURIComponent(botId)}/chats/${encodeURIComponent(lineChatUserId)}/messages`;
        const response = await page.evaluate(async (targetUrl) => {
          const res = await fetch(targetUrl, { credentials: "include" });
          let body: unknown = null;
          try { body = await res.json(); } catch {}
          return { status: res.status, ok: res.ok, body };
        }, url);
        console.log(JSON.stringify({
          event: "line_chat_message_api_inspection",
          conversationId: conversation.id,
          customerName: conversation.customer.displayName,
          status: response.status,
          ok: response.ok,
          body: pickMessageFields(response.body),
        }));
      }
    } finally {
      await sessionService.closeManagedPersistentContext(context, profilePath).catch(() => {});
    }
  } finally {
    await app.close();
  }
}

void main().catch((error) => {
  console.error(JSON.stringify({
    event: "line_chat_message_api_inspection_fatal",
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
