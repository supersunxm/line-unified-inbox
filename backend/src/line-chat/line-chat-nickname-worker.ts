import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { createServer, request as httpRequest, type IncomingMessage, type ServerResponse } from "node:http";
import { connect as netConnect } from "node:net";
import { timingSafeEqual } from "node:crypto";
import { LineChatNicknameWorkerModule } from "./line-chat-nickname-worker.module";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";
import { LineChatManagerMessageRelayWorkerService } from "./line-chat-manager-message-relay-worker.service";
import { LineChatManagerImageRelayWorkerService } from "./line-chat-manager-image-relay-worker.service";
import { LineChatNovncRecoveryWorkerService } from "./line-chat-novnc-recovery-worker.service";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import { LineChatSessionService } from "./line-chat-session.service";
import type { ManagerRelayConversationSnapshot } from "./line-chat-manager-message-relay.service";

const MAX_INTERNAL_BODY_BYTES = 64 * 1024;
const NOVNC_PROXY_PORT = 6080;

type RelayLoaderTarget = {
  loadConversation: (id: string) => Promise<unknown>;
};

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function secretMatches(received: string | string[] | undefined, expected: string): boolean {
  const candidate = Array.isArray(received) ? received[0] ?? "" : received ?? "";
  const receivedBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || expectedBuffer.length === 0) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_INTERNAL_BODY_BYTES) throw new Error("REQUEST_TOO_LARGE");
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function recoveryPath(requestUrl: URL): { token: string; upstreamPath: string } | null {
  const match = requestUrl.pathname.match(/^\/recovery\/([^/]+)\/(.*)$/u);
  if (!match) return null;
  return {
    token: decodeURIComponent(match[1]),
    upstreamPath: `/${match[2] || "vnc.html"}${requestUrl.search}`,
  };
}

function proxyNovncHttp(request: IncomingMessage, response: ServerResponse, upstreamPath: string): void {
  const upstream = httpRequest({
    host: "127.0.0.1",
    port: NOVNC_PROXY_PORT,
    method: request.method,
    path: upstreamPath,
    headers: { ...request.headers, host: `127.0.0.1:${NOVNC_PROXY_PORT}` },
  }, (upstreamResponse) => {
    response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
    upstreamResponse.pipe(response);
  });
  upstream.on("error", () => writeJson(response, 503, { success: false, error: "RECOVERY_PROXY_UNAVAILABLE" }));
  request.pipe(upstream);
}

function isRelaySnapshot(value: unknown, expectedConversationId: string): value is ManagerRelayConversationSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<ManagerRelayConversationSnapshot>;
  const oa = snapshot.lineOfficialAccount;
  const session = oa?.lineChatSession;
  return snapshot.id === expectedConversationId
    && typeof snapshot.storeCode === "string"
    && Boolean(snapshot.storeCode.trim())
    && typeof snapshot.lineOfficialAccountId === "string"
    && snapshot.lineOfficialAccountId === oa?.id
    && typeof oa?.chatBotId === "string"
    && Boolean(oa.chatBotId.trim())
    && typeof session?.id === "string"
    && typeof session?.sessionKey === "string"
    && Boolean(session.sessionKey.trim());
}

function snapshotAsRelayConversation(snapshot: ManagerRelayConversationSnapshot): unknown {
  const oa = snapshot.lineOfficialAccount;
  return {
    id: snapshot.id,
    storeId: snapshot.storeId,
    lineOfficialAccountId: snapshot.lineOfficialAccountId,
    lineChatUserId: snapshot.lineChatUserId,
    store: {
      code: snapshot.storeCode,
      storeMaster: null,
    },
    lineOfficialAccount: {
      id: oa.id,
      name: oa.name,
      storeId: oa.storeId,
      accountType: oa.accountType,
      isActive: oa.isActive,
      archivedAt: oa.archivedAt ? new Date(oa.archivedAt) : null,
      chatBotId: oa.chatBotId,
      lineChatSession: {
        id: oa.lineChatSession.id,
        sessionKey: oa.lineChatSession.sessionKey,
        profilePath: oa.lineChatSession.profilePath,
        profileStorageKey: oa.lineChatSession.profileStorageKey,
        status: oa.lineChatSession.status,
      },
    },
  };
}

function installRelayContextLoader(
  service: object,
  contexts: Map<string, ManagerRelayConversationSnapshot>,
): void {
  const target = service as RelayLoaderTarget;
  const originalLoadConversation = target.loadConversation.bind(service);
  target.loadConversation = async (id: string) => {
    const snapshot = contexts.get(id);
    if (snapshot && isRelaySnapshot(snapshot, id)) return snapshotAsRelayConversation(snapshot);
    return originalLoadConversation(id);
  };
}

async function bootstrap() {
  const logger = new Logger("LineChatNicknameWorker");
  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn", "log"],
  });

  app.get(LineChatNicknameWorkerService);
  const textRelay = app.get(LineChatManagerMessageRelayWorkerService);
  const imageRelay = app.get(LineChatManagerImageRelayWorkerService);
  const recovery = app.get(LineChatNovncRecoveryWorkerService);
  const recentResolver = app.get(LineChatRecentResolverService);
  const sessionService = app.get(LineChatSessionService);
  const relayContexts = new Map<string, ManagerRelayConversationSnapshot>();
  installRelayContextLoader(textRelay, relayContexts);
  installRelayContextLoader(imageRelay, relayContexts);

  const internalSecret = process.env.LINE_CHAT_WORKER_INTERNAL_SECRET?.trim() || "";
  const internalPort = Number(process.env.LINE_CHAT_INTERNAL_PORT || "3002");

  const server = createServer(async (request, response) => {
    let activeRelayContext: ManagerRelayConversationSnapshot | null = null;
    let activeConversationId = "";
    try {
      const requestUrl = new URL(request.url || "/", "http://line-chat-worker.internal");
      const publicRecovery = recoveryPath(requestUrl);
      if (request.method === "GET" && publicRecovery) {
        if (!recovery.authorize(publicRecovery.token)) {
          writeJson(response, 404, { success: false, error: "RECOVERY_NOT_FOUND" });
          return;
        }
        proxyNovncHttp(request, response, publicRecovery.upstreamPath);
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/internal/health") {
        writeJson(response, 200, { ok: true, service: "line-chat-nickname-worker" });
        return;
      }

      if (!internalSecret || !secretMatches(request.headers["x-line-chat-internal-secret"], internalSecret)) {
        writeJson(response, 401, { success: false, error: "UNAUTHORIZED" });
        return;
      }

      if (request.method === "GET" && requestUrl.pathname === "/internal/line-chat/recovery/status") {
        writeJson(response, 200, { success: true, ...recovery.snapshot() });
        return;
      }
      if (request.method === "POST" && (requestUrl.pathname === "/internal/line-chat/recovery/start" || requestUrl.pathname === "/internal/line-chat/recovery/stop")) {
        const body = await readJsonBody(request) as { sessionKey?: unknown };
        if (typeof body.sessionKey !== "string" || !body.sessionKey.trim()) {
          writeJson(response, 400, { success: false, error: "INVALID_REQUEST" });
          return;
        }
        const result = requestUrl.pathname.endsWith("/start")
          ? await recovery.start(body.sessionKey.trim())
          : await recovery.stop(body.sessionKey.trim());
        writeJson(response, 200, { success: true, ...result });
        return;
      }

      if (request.method === "POST" && requestUrl.pathname === "/internal/line-chat/candidates") {
        const body = await readJsonBody(request) as {
          lineOfficialAccountId?: unknown;
          botId?: unknown;
          sessionKey?: unknown;
          profileStorageKey?: unknown;
          force?: unknown;
        };
        const oaId = typeof body.lineOfficialAccountId === "string" ? body.lineOfficialAccountId.trim() : "";
        const botId = typeof body.botId === "string" ? body.botId.trim() : "";
        const sessionKey = typeof body.sessionKey === "string" ? body.sessionKey.trim() : "";
        if (!oaId || !botId || !sessionKey) {
          writeJson(response, 400, { success: false, error: "INVALID_REQUEST" });
          return;
        }
        const profilePath = sessionService.resolveProfilePath({
          sessionKey,
          profileStorageKey: (typeof body.profileStorageKey === "string" ? body.profileStorageKey.trim() : null) || null,
          profilePath: null,
        });
        const snapshot = await recentResolver.refreshSnapshot({
          lineOfficialAccountId: oaId,
          botId,
          sessionKey,
          profilePath,
          force: Boolean(body.force),
        });
        writeJson(response, 200, {
          success: true,
          snapshot: {
            status: snapshot.status,
            chats: snapshot.chats,
            pagesFetched: snapshot.pagesFetched,
            totalRawRecords: snapshot.totalRawRecords,
            failureReason: snapshot.failureReason,
          },
        });
        return;
      }

      const isTextRelay = request.method === "POST" && requestUrl.pathname === "/internal/line-chat/send-text";
      const isImageRelay = request.method === "POST" && requestUrl.pathname === "/internal/line-chat/send-image";
      if (!isTextRelay && !isImageRelay) {
        writeJson(response, 404, { success: false, error: "NOT_FOUND" });
        return;
      }

      const body = await readJsonBody(request) as {
        conversationId?: unknown;
        text?: unknown;
        imageUrl?: unknown;
        idempotencyKey?: unknown;
        relayContext?: unknown;
      };
      const commonInvalid =
        typeof body.conversationId !== "string"
        || !body.conversationId.trim()
        || typeof body.idempotencyKey !== "string"
        || !body.idempotencyKey.trim()
        || body.idempotencyKey.length > 200;
      const textInvalid = isTextRelay && (typeof body.text !== "string" || !body.text.trim() || body.text.length > 5000);
      const imageInvalid = isImageRelay && (typeof body.imageUrl !== "string" || !body.imageUrl.trim() || body.imageUrl.length > 4096);
      if (commonInvalid || textInvalid || imageInvalid) {
        writeJson(response, 400, { success: false, error: "INVALID_REQUEST" });
        return;
      }

      activeConversationId = (body.conversationId as string).trim();
      if (body.relayContext !== undefined) {
        if (!isRelaySnapshot(body.relayContext, activeConversationId)) {
          writeJson(response, 400, { success: false, error: "INVALID_RELAY_CONTEXT" });
          return;
        }
        activeRelayContext = body.relayContext;
        relayContexts.set(activeConversationId, activeRelayContext);
        logger.log(JSON.stringify({
          event: "line_chat_relay_context_received",
          conversationId: activeConversationId,
          storeCode: activeRelayContext.storeCode,
          hasLineChatUserId: Boolean(activeRelayContext.lineChatUserId?.trim()),
        }));
      }

      const result = isTextRelay
        ? await textRelay.relayText({
            conversationId: activeConversationId,
            text: body.text as string,
            idempotencyKey: (body.idempotencyKey as string).trim(),
          })
        : await imageRelay.relayImage({
            conversationId: activeConversationId,
            imageUrl: (body.imageUrl as string).trim(),
            idempotencyKey: (body.idempotencyKey as string).trim(),
          });

      if (!result.handled) {
        writeJson(response, 409, { success: false, handled: false, error: "NOT_PILOT_CONVERSATION" });
        return;
      }
      writeJson(response, 200, { success: true, handled: true, duplicate: result.duplicate, lineChatUserId: result.lineChatUserId });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(JSON.stringify({ event: "line_chat_internal_relay_request_failed", error: message }));
      writeJson(response, message === "REQUEST_TOO_LARGE" ? 413 : 503, {
        success: false,
        error: message === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : message,
      });
    } finally {
      if (activeRelayContext && relayContexts.get(activeConversationId) === activeRelayContext) {
        relayContexts.delete(activeConversationId);
      }
    }
  });

  server.on("upgrade", (request, socket, head) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://line-chat-worker.internal");
      const target = recoveryPath(requestUrl);
      if (!target || !target.upstreamPath.startsWith("/websockify") || !recovery.authorize(target.token)) {
        socket.write("HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n");
        socket.destroy();
        return;
      }
      const upstream = netConnect(NOVNC_PROXY_PORT, "127.0.0.1", () => {
        const headers = Object.entries(request.headers)
          .filter(([, value]) => value !== undefined)
          .map(([name, value]) => `${name}: ${Array.isArray(value) ? value.join(", ") : value}`)
          .join("\r\n");
        upstream.write(`${request.method || "GET"} ${target.upstreamPath} HTTP/${request.httpVersion}\r\n${headers}\r\n\r\n`);
        if (head.length) upstream.write(head);
        socket.pipe(upstream).pipe(socket);
      });
      upstream.on("error", () => socket.destroy());
    } catch {
      socket.destroy();
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(internalPort, "::", () => {
      server.off("error", reject);
      resolve();
    });
  });
  logger.log(`Private LINE Chat relay endpoint listening on port ${internalPort}`);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await recovery.stop("profile-b", "process_shutdown").catch(() => undefined);
    await new Promise<void>((resolve) => server.close(() => resolve())).catch(() => {});
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void bootstrap();
