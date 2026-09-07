import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { LineChatNicknameWorkerModule } from "./line-chat-nickname-worker.module";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";
import { LineChatManagerMessageRelayWorkerService } from "./line-chat-manager-message-relay-worker.service";
import { LineChatManagerImageRelayWorkerService } from "./line-chat-manager-image-relay-worker.service";

const MAX_INTERNAL_BODY_BYTES = 64 * 1024;

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

async function bootstrap() {
  const logger = new Logger("LineChatNicknameWorker");
  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn", "log"],
  });

  app.get(LineChatNicknameWorkerService);
  const textRelay = app.get(LineChatManagerMessageRelayWorkerService);
  const imageRelay = app.get(LineChatManagerImageRelayWorkerService);
  const internalSecret = process.env.LINE_CHAT_WORKER_INTERNAL_SECRET?.trim() || "";
  const internalPort = Number(process.env.LINE_CHAT_INTERNAL_PORT || "3002");

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url || "/", "http://line-chat-worker.internal");

      if (request.method === "GET" && requestUrl.pathname === "/internal/health") {
        writeJson(response, 200, { ok: true, service: "line-chat-nickname-worker" });
        return;
      }

      const isTextRelay = request.method === "POST" && requestUrl.pathname === "/internal/line-chat/send-text";
      const isImageRelay = request.method === "POST" && requestUrl.pathname === "/internal/line-chat/send-image";
      if (!isTextRelay && !isImageRelay) {
        writeJson(response, 404, { success: false, error: "NOT_FOUND" });
        return;
      }

      if (!internalSecret || !secretMatches(request.headers["x-line-chat-internal-secret"], internalSecret)) {
        writeJson(response, 401, { success: false, error: "UNAUTHORIZED" });
        return;
      }

      const body = await readJsonBody(request) as {
        conversationId?: unknown;
        text?: unknown;
        imageUrl?: unknown;
        idempotencyKey?: unknown;
      };
      const commonInvalid =
        typeof body.conversationId !== "string"
        || !body.conversationId.trim()
        || typeof body.idempotencyKey !== "string"
        || !body.idempotencyKey.trim()
        || body.idempotencyKey.length > 200;
      const textInvalid = isTextRelay && (
        typeof body.text !== "string"
        || !body.text.trim()
        || body.text.length > 5000
      );
      const imageInvalid = isImageRelay && (
        typeof body.imageUrl !== "string"
        || !body.imageUrl.trim()
        || body.imageUrl.length > 4096
      );
      if (commonInvalid || textInvalid || imageInvalid) {
        writeJson(response, 400, { success: false, error: "INVALID_REQUEST" });
        return;
      }

      const result = isTextRelay
        ? await textRelay.relayText({
            conversationId: (body.conversationId as string).trim(),
            text: body.text as string,
            idempotencyKey: (body.idempotencyKey as string).trim(),
          })
        : await imageRelay.relayImage({
            conversationId: (body.conversationId as string).trim(),
            imageUrl: (body.imageUrl as string).trim(),
            idempotencyKey: (body.idempotencyKey as string).trim(),
          });

      if (!result.handled) {
        writeJson(response, 409, { success: false, handled: false, error: "NOT_PILOT_CONVERSATION" });
        return;
      }

      writeJson(response, 200, {
        success: true,
        handled: true,
        duplicate: result.duplicate,
        lineChatUserId: result.lineChatUserId,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(JSON.stringify({
        event: "line_chat_internal_relay_request_failed",
        error: message,
      }));
      writeJson(response, message === "REQUEST_TOO_LARGE" ? 413 : 503, {
        success: false,
        error: message === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : message,
      });
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
    await new Promise<void>((resolve) => server.close(() => resolve())).catch(() => {});
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void bootstrap();
