import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import {
  LineAccountType,
  MediaProcessingStatus,
  MessageDirection,
  MessageType,
} from "@prisma/client";
import type { APIResponse, BrowserContext } from "playwright";
import * as fs from "node:fs";
import { PrismaService } from "../prisma.service";
import { MediaStorageService } from "../media/media-storage";
import { objectKeyFor } from "../media/line-image.service";
import { isPdfMagicBytes, PDF_MIME_TYPE, readPdfMaxBytes } from "../media/pdf-media";
import { confirmLineManagerAuthentication } from "./line-chat-manager-auth-confirmation";
import { LineChatMirrorService } from "./line-chat-mirror.service";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { configuredLineChatMirrorReconcileStoreCodes } from "./line-chat-mirror-reconciler.service";

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 30_000;
const DEFAULT_BATCH_SIZE = 8;
const MAX_BATCH_SIZE = 20;
const START_DELAY_MS = 20_000;
const DEFAULT_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MAX_JSON_DEPTH = 6;

const MATERIALIZABLE_TYPES = new Set<MessageType>([
  MessageType.IMAGE,
  MessageType.VIDEO,
  MessageType.FILE,
  MessageType.STICKER,
]);

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};
const VIDEO_EXTENSIONS: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/3gpp": "3gp",
  "video/webm": "webm",
};

type JsonRecord = Record<string, unknown>;

type ManagerMessagePayload = JsonRecord | null;

type DownloadedManagerMedia = {
  body: Buffer;
  mimeType: string;
  extension: string;
  source: "CONTENT_HASH" | "PAYLOAD_URL" | "DIRECT_CONTENT" | "STICKER_CDN";
  stickerId?: string;
  packageId?: string;
};

function positiveInteger(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function isManagerMediaMaterializationEnabled(): boolean {
  return process.env.LINE_CHAT_MIRROR_MEDIA_MATERIALIZE_ENABLED?.trim().toLowerCase() === "true";
}

export function configuredManagerMediaMaterializationStoreCodes(): string[] {
  const raw = process.env.LINE_CHAT_MIRROR_MEDIA_MATERIALIZE_STORE_CODES?.trim();
  if (!raw) return configuredLineChatMirrorReconcileStoreCodes();
  return [...new Set(raw.split(/[\s,;]+/u).map((value) => value.trim()).filter(Boolean))];
}

export function managerMediaMaterializationIntervalMs(): number {
  return Math.max(
    MIN_INTERVAL_MS,
    positiveInteger(process.env.LINE_CHAT_MIRROR_MEDIA_MATERIALIZE_INTERVAL_MS, DEFAULT_INTERVAL_MS),
  );
}

export function managerMediaMaterializationBatchSize(): number {
  return Math.min(
    MAX_BATCH_SIZE,
    positiveInteger(process.env.LINE_CHAT_MIRROR_MEDIA_MATERIALIZE_BATCH_SIZE, DEFAULT_BATCH_SIZE),
  );
}

function jsonRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function findNestedStringByKey(
  value: unknown,
  acceptedKeys: readonly string[],
  depth = 0,
): string | null {
  if (depth > MAX_JSON_DEPTH || value === null || typeof value !== "object") return null;
  const record = jsonRecord(value);
  if (record) {
    for (const key of acceptedKeys) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    for (const child of Object.values(record)) {
      const found = findNestedStringByKey(child, acceptedKeys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const child of value as unknown[]) {
    const found = findNestedStringByKey(child, acceptedKeys, depth + 1);
    if (found) return found;
  }
  return null;
}

export function extractManagerContentHash(value: unknown): string | null {
  return findNestedStringByKey(value, [
    "contentHash",
    "content_hash",
    "originalContentHash",
    "original_content_hash",
  ]);
}

export function extractManagerStickerIdentity(value: unknown): {
  stickerId: string | null;
  packageId: string | null;
} {
  return {
    stickerId: findNestedStringByKey(value, ["stickerId", "sticker_id"]),
    packageId: findNestedStringByKey(value, ["packageId", "package_id"]),
  };
}

export function extractManagerMediaUrlCandidates(value: unknown): string[] {
  const found = new Set<string>();
  const visit = (current: unknown, depth: number): void => {
    if (depth > MAX_JSON_DEPTH || current === null || typeof current !== "object") return;
    if (Array.isArray(current)) {
      current.forEach((item) => visit(item, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(current as JsonRecord)) {
      if (
        typeof child === "string"
        && /(url|uri|download|content|original|preview|thumbnail)/i.test(key)
      ) {
        try {
          const parsed = new URL(child, "https://chat.line.biz");
          if (
            parsed.protocol === "https:"
            && (
              parsed.hostname === "chat.line.biz"
              || parsed.hostname === "chat-content.line-scdn.net"
              || parsed.hostname.endsWith(".line-scdn.net")
            )
          ) {
            found.add(parsed.toString());
          }
        } catch {
          // Ignore malformed candidates.
        }
      }
      visit(child, depth + 1);
    }
  };
  visit(value, 0);
  return [...found].slice(0, 12);
}

function findObjectWithId(value: unknown, targetId: string, depth = 0): JsonRecord | null {
  if (depth > MAX_JSON_DEPTH || value === null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const child of value) {
      const found = findObjectWithId(child, targetId, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const record = value as JsonRecord;
  if (typeof record.id === "string" && record.id.trim() === targetId) return record;
  for (const child of Object.values(record)) {
    const found = findObjectWithId(child, targetId, depth + 1);
    if (found) return found;
  }
  return null;
}

function normalizeMime(raw: string | undefined): string {
  return (raw ?? "").split(";", 1)[0].trim().toLowerCase();
}

function ascii(body: Buffer, start: number, end: number): string {
  return body.subarray(start, end).toString("ascii");
}

export function inferManagerMediaMimeFromMagic(
  messageType: MessageType,
  body: Buffer,
): string | null {
  if (messageType === MessageType.IMAGE || messageType === MessageType.STICKER) {
    if (body.length >= 3 && body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) return "image/jpeg";
    if (
      body.length >= 8
      && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    ) return "image/png";
    if (body.length >= 6 && (ascii(body, 0, 6) === "GIF87a" || ascii(body, 0, 6) === "GIF89a")) return "image/gif";
    if (body.length >= 12 && ascii(body, 0, 4) === "RIFF" && ascii(body, 8, 12) === "WEBP") return "image/webp";
  }

  if (messageType === MessageType.VIDEO) {
    if (body.length >= 12 && ascii(body, 4, 8) === "ftyp") {
      const brand = ascii(body, 8, 12).toLowerCase();
      if (brand.startsWith("3gp")) return "video/3gpp";
      if (brand === "qt  ") return "video/quicktime";
      return "video/mp4";
    }
    if (
      body.length >= 4
      && body[0] === 0x1a
      && body[1] === 0x45
      && body[2] === 0xdf
      && body[3] === 0xa3
    ) return "video/webm";
  }

  return null;
}

function safeJsonKeyNames(value: unknown): string[] {
  const record = jsonRecord(value);
  return record ? Object.keys(record).sort().slice(0, 40) : [];
}

function managerMediaCandidateKind(
  url: string,
  contentHash: string | null,
): "CONTENT_HASH" | "PAYLOAD_URL" | "DIRECT_CONTENT" {
  if (contentHash && url.includes(contentHash)) return "CONTENT_HASH";
  return url.includes("/messages/content/") ? "DIRECT_CONTENT" : "PAYLOAD_URL";
}

function fileExtensionFor(input: {
  messageType: MessageType;
  mimeType: string;
  fileName: string | null;
  body: Buffer;
}): { mimeType: string; extension: string } | null {
  if (input.messageType === MessageType.IMAGE || input.messageType === MessageType.STICKER) {
    const effectiveMime = IMAGE_EXTENSIONS[input.mimeType]
      ? input.mimeType
      : inferManagerMediaMimeFromMagic(input.messageType, input.body);
    if (!effectiveMime) return null;
    const extension = IMAGE_EXTENSIONS[effectiveMime];
    return extension ? { mimeType: effectiveMime, extension } : null;
  }
  if (input.messageType === MessageType.VIDEO) {
    const effectiveMime = VIDEO_EXTENSIONS[input.mimeType]
      ? input.mimeType
      : inferManagerMediaMimeFromMagic(input.messageType, input.body);
    if (!effectiveMime) return null;
    const extension = VIDEO_EXTENSIONS[effectiveMime];
    return extension ? { mimeType: effectiveMime, extension } : null;
  }
  if (input.messageType === MessageType.FILE) {
    const looksPdf = isPdfMagicBytes(input.body);
    if (
      looksPdf
      && (
        input.mimeType === PDF_MIME_TYPE
        || input.mimeType === "application/octet-stream"
        || input.fileName?.toLowerCase().endsWith(".pdf")
      )
    ) {
      return { mimeType: PDF_MIME_TYPE, extension: "pdf" };
    }
  }
  return null;
}

function maxBytesFor(messageType: MessageType): number {
  if (messageType === MessageType.VIDEO) {
    return positiveInteger(process.env.MEDIA_MAX_VIDEO_FILE_SIZE_BYTES, DEFAULT_MAX_VIDEO_BYTES);
  }
  if (messageType === MessageType.FILE) return readPdfMaxBytes();
  return positiveInteger(process.env.MEDIA_MAX_FILE_SIZE_BYTES, DEFAULT_MAX_IMAGE_BYTES);
}

async function responseBuffer(response: APIResponse, maxBytes: number): Promise<Buffer> {
  const declared = Number(response.headers()["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error("MANAGER_MEDIA_TOO_LARGE");
  }
  const body = await response.body();
  if (body.length > maxBytes) throw new Error("MANAGER_MEDIA_TOO_LARGE");
  if (body.length === 0) throw new Error("MANAGER_MEDIA_EMPTY");
  return body;
}

function storeCodeOf(message: {
  conversation: {
    store: {
      code: string | null;
      storeMaster: { externalStoreId: string | null } | null;
    } | null;
  };
}): string {
  return message.conversation.store?.code?.trim()
    || message.conversation.store?.storeMaster?.externalStoreId?.trim()
    || "";
}

@Injectable()
export class LineChatManagerMediaMaterializerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LineChatManagerMediaMaterializerService.name);
  private timer: NodeJS.Timeout | null = null;
  private startupTimer: NodeJS.Timeout | null = null;
  private running = false;
  private readonly retryNotBefore = new Map<string, number>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatProfileOperationCoordinator)
    private readonly coordinator: LineChatProfileOperationCoordinator,
    @Inject(LineChatMirrorService) private readonly mirrorService: LineChatMirrorService,
    @Inject(MediaStorageService) private readonly storage: MediaStorageService,
  ) {}

  onModuleInit(): void {
    if (
      process.env.NODE_ENV === "test"
      || !isManagerMediaMaterializationEnabled()
      || configuredManagerMediaMaterializationStoreCodes().length === 0
    ) {
      return;
    }

    const run = () => void this.runCycle().catch((error: unknown) => {
      this.logger.error(JSON.stringify({
        event: "line_chat_manager_media_materialize_cycle_failed",
        error: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
      }));
    });

    this.startupTimer = setTimeout(run, START_DELAY_MS);
    this.startupTimer.unref?.();
    this.timer = setInterval(run, managerMediaMaterializationIntervalMs());
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.timer) clearInterval(this.timer);
    this.startupTimer = null;
    this.timer = null;
  }

  public async runCycle(): Promise<void> {
    if (this.running) return;
    this.running = true;
    const startedAt = Date.now();
    const storeCodes = new Set(configuredManagerMediaMaterializationStoreCodes());
    let scanned = 0;
    let ready = 0;
    let failed = 0;
    let deferred = 0;
    let skipped = 0;

    try {
      const recent = await this.prisma.message.findMany({
        where: {
          direction: MessageDirection.OUTBOUND,
          messageType: { in: [...MATERIALIZABLE_TYPES] },
          externalMessageId: { startsWith: "line-chat-manager:" },
          conversation: {
            lineOfficialAccount: {
              accountType: LineAccountType.STORE,
              isActive: true,
              archivedAt: null,
            },
          },
        },
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        take: 200,
        select: {
          id: true,
          externalMessageId: true,
          messageType: true,
          fileName: true,
          sentAt: true,
          rawPayload: true,
          media: {
            select: {
              processingStatus: true,
            },
          },
          conversation: {
            select: {
              store: {
                select: {
                  code: true,
                  storeMaster: {
                    select: {
                      externalStoreId: true,
                      lineManagerUrl: true,
                    },
                  },
                },
              },
              lineOfficialAccount: {
                select: {
                  id: true,
                  basicId: true,
                  lineChatWorkspaceUrl: true,
                  chatBotId: true,
                  lineChatSession: {
                    select: {
                      id: true,
                      sessionKey: true,
                      status: true,
                      profilePath: true,
                      profileStorageKey: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const candidates = recent
        .filter((message) => {
          if (!storeCodes.has(storeCodeOf(message))) return false;
          if (message.media?.processingStatus === MediaProcessingStatus.READY) return false;
          const retryAt = this.retryNotBefore.get(message.id) ?? 0;
          return retryAt <= Date.now();
        })
        .slice(0, managerMediaMaterializationBatchSize());

      for (const message of candidates) {
        scanned += 1;
        try {
          const outcome = await this.materializeMessage(message);
          if (outcome === "READY") ready += 1;
          else skipped += 1;
          this.retryNotBefore.delete(message.id);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240);
          if (errorMessage === "MANAGER_MEDIA_PROFILE_BUSY") {
            deferred += 1;
            this.retryNotBefore.set(message.id, Date.now() + 30_000);
            this.logger.log(JSON.stringify({
              event: "line_chat_manager_media_materialize_deferred",
              storeCode: storeCodeOf(message),
              messageType: message.messageType,
              reason: errorMessage,
            }));
            continue;
          }

          failed += 1;
          this.retryNotBefore.set(message.id, Date.now() + 5 * 60_000);
          await this.markFailed(message.id, message.externalMessageId, message.messageType, errorMessage).catch(() => {});
          this.logger.warn(JSON.stringify({
            event: "line_chat_manager_media_materialize_failed",
            storeCode: storeCodeOf(message),
            messageType: message.messageType,
            error: errorMessage,
          }));
        }
      }

      this.logger.log(JSON.stringify({
        event: "line_chat_manager_media_materialize_cycle_completed",
        storeCodes: [...storeCodes],
        scanned,
        ready,
        failed,
        deferred,
        skipped,
        durationMs: Date.now() - startedAt,
      }));
    } finally {
      this.running = false;
    }
  }

  private async materializeMessage(message: Awaited<ReturnType<LineChatManagerMediaMaterializerService["loadMessageForMaterialization"]>>): Promise<"READY" | "SKIPPED"> {
    if (!message) return "SKIPPED";
    return this.materializeLoadedMessage(message);
  }

  private async loadMessageForMaterialization(messageId: string) {
    return this.prisma.message.findUnique({
      where: { id: messageId },
      select: {
        id: true,
        externalMessageId: true,
        messageType: true,
        fileName: true,
        sentAt: true,
        rawPayload: true,
        conversation: {
          select: {
            store: {
              select: {
                code: true,
                storeMaster: {
                  select: {
                    externalStoreId: true,
                    lineManagerUrl: true,
                  },
                },
              },
            },
            lineOfficialAccount: {
              select: {
                id: true,
                basicId: true,
                lineChatWorkspaceUrl: true,
                chatBotId: true,
                lineChatSession: {
                  select: {
                    id: true,
                    sessionKey: true,
                    status: true,
                    profilePath: true,
                    profileStorageKey: true,
                  },
                },
              },
            },
          },
        },
      },
    });
  }

  private async materializeLoadedMessage(message: NonNullable<Awaited<ReturnType<LineChatManagerMediaMaterializerService["loadMessageForMaterialization"]>>>): Promise<"READY" | "SKIPPED"> {
    if (!MATERIALIZABLE_TYPES.has(message.messageType)) return "SKIPPED";
    const mirror = await this.prisma.lineChatMirrorMessage.findFirst({
      where: { canonicalMessageId: message.id },
      select: {
        managerMessageId: true,
        lineChatUserId: true,
        messageType: true,
      },
    });
    if (!mirror) throw new Error("MANAGER_MEDIA_MIRROR_ROW_MISSING");

    const oa = message.conversation.lineOfficialAccount;
    const target = await this.mirrorService.resolveMirrorTarget({
      lineOfficialAccountId: oa.id,
      chatBotId: oa.chatBotId,
      basicId: oa.basicId,
      lineChatWorkspaceUrl: oa.lineChatWorkspaceUrl,
      storeManagerUrl: message.conversation.store?.storeMaster?.lineManagerUrl ?? null,
      lineChatSession: oa.lineChatSession,
    });
    if (!target.ok) throw new Error(target.errorCode);

    const profilePath = this.sessionService.resolveProfilePath(target.session);
    if (!fs.existsSync(profilePath)) throw new Error("MANAGER_MEDIA_PROFILE_MISSING");

    const operation = await this.coordinator.withProfileOperation(
      { sessionId: target.session.id, operationKind: "MIRROR_SYNC" },
      async (operationContext) => {
        operationContext.assertOwnership();
        let context: BrowserContext | null = null;
        try {
          context = await this.sessionService.launchManagedPersistentContext(
            profilePath,
            {
              profilePath,
              headless: true,
              viewport: { width: 1280, height: 800 },
              args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-blink-features=AutomationControlled",
              ],
            },
            { sessionId: target.session.id, sessionKey: target.session.sessionKey },
          );
          const page = context.pages()[0] || await context.newPage();
          const referer = this.sessionService.buildChatRefererUrl(target.botId, mirror.lineChatUserId);
          await page.goto(referer, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
          const auth = await confirmLineManagerAuthentication(
            () => this.sessionService.probeApiAuthentication(context!),
            (ms) => page.waitForTimeout(ms),
          );
          if (auth.outcome !== "AUTHENTICATED") {
            throw new Error(`MANAGER_MEDIA_AUTH_${auth.outcome}`);
          }

          const managerHeaders = await this.managerRequestHeaders(context, referer);
          const managerPayload = await this.loadManagerMessagePayload(
            context,
            target.botId,
            mirror.lineChatUserId,
            mirror.managerMessageId,
            managerHeaders,
          );
          const downloaded = message.messageType === MessageType.STICKER
            ? await this.downloadSticker(context, managerPayload)
            : await this.downloadManagerMedia(
                context,
                target.botId,
                mirror.managerMessageId,
                managerPayload,
                message.messageType,
                message.fileName,
                referer,
                managerHeaders,
              );
          operationContext.assertOwnership();
          return downloaded;
        } finally {
          if (context) {
            await this.sessionService.closeManagedPersistentContext(context, profilePath).catch(() => {});
          }
        }
      },
      { waitForLock: true, waitForLockMs: 15_000 },
    );

    if (!operation.acquired) throw new Error("MANAGER_MEDIA_PROFILE_BUSY");
    const downloaded = operation.value;
    const providerMessageId = `line-chat-manager:${mirror.managerMessageId}`;
    const objectKey = objectKeyFor(
      oa.id,
      message.sentAt,
      providerMessageId,
      downloaded.extension,
    );
    const stored = await this.storage.put(objectKey, downloaded.body, downloaded.mimeType);

    await this.prisma.messageMedia.upsert({
      where: { messageId: message.id },
      update: {
        providerMessageId,
        mediaType: message.messageType,
        mimeType: stored.mimeType,
        objectKey: stored.provider === "google-drive" ? null : objectKey,
        provider: stored.provider,
        fileId: stored.fileId,
        fileSize: stored.size,
        processingStatus: MediaProcessingStatus.READY,
        errorCode: null,
        errorMessage: null,
      },
      create: {
        messageId: message.id,
        providerMessageId,
        mediaType: message.messageType,
        mimeType: stored.mimeType,
        objectKey: stored.provider === "google-drive" ? null : objectKey,
        provider: stored.provider,
        fileId: stored.fileId,
        fileSize: stored.size,
        processingStatus: MediaProcessingStatus.READY,
      },
    });

    if (message.messageType === MessageType.STICKER) {
      const raw = jsonRecord(message.rawPayload) ?? {};
      await this.prisma.message.update({
        where: { id: message.id },
        data: {
          rawPayload: {
            ...raw,
            type: "sticker",
            ...(downloaded.stickerId ? { stickerId: downloaded.stickerId } : {}),
            ...(downloaded.packageId ? { packageId: downloaded.packageId } : {}),
          },
        },
      });
    }

    this.logger.log(JSON.stringify({
      event: "line_chat_manager_media_materialized",
      storeCode: storeCodeOf(message),
      messageType: message.messageType,
      mimeType: downloaded.mimeType,
      fileSize: downloaded.body.length,
      source: downloaded.source,
    }));
    return "READY";
  }

  private async managerRequestHeaders(
    context: BrowserContext,
    referer: string,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      accept: "application/json, text/plain, */*",
      referer,
    };
    const csrfResponse = await context.request.get(
      "https://chat.line.biz/api/v1/csrfToken",
      { headers: { referer }, timeout: 10_000 },
    ).catch(() => null);
    if (!csrfResponse?.ok()) return headers;
    const body: unknown = await csrfResponse.json().catch(() => null);
    const token = jsonRecord(body)?.token;
    if (typeof token === "string" && token.trim()) {
      headers["x-xsrf-token"] = token.trim();
    }
    return headers;
  }

  private async loadManagerMessagePayload(
    context: BrowserContext,
    botId: string,
    lineChatUserId: string,
    managerMessageId: string,
    headers: Record<string, string>,
  ): Promise<ManagerMessagePayload> {
    const urls = [
      `https://chat.line.biz/api/v3/bots/${encodeURIComponent(botId)}/chats/${encodeURIComponent(lineChatUserId)}/messages`,
      `https://chat.line.biz/api/v1/bots/${encodeURIComponent(botId)}/messages/${encodeURIComponent(lineChatUserId)}`,
    ];
    for (const url of urls) {
      const response = await context.request.get(url, { headers, timeout: 20_000 }).catch(() => null);
      if (!response?.ok()) continue;
      const body: unknown = await response.json().catch(() => null);
      const event = findObjectWithId(body, managerMessageId);
      if (event) return event;
    }
    return null;
  }

  private async downloadManagerMedia(
    context: BrowserContext,
    botId: string,
    managerMessageId: string,
    payload: ManagerMessagePayload,
    messageType: MessageType,
    fileName: string | null,
    referer: string,
    managerHeaders: Record<string, string>,
  ): Promise<DownloadedManagerMedia> {
    const maxBytes = maxBytesFor(messageType);
    const infoUrl = `https://chat.line.biz/api/v1/bots/${encodeURIComponent(botId)}/messages/content/${encodeURIComponent(managerMessageId)}/info`;
    const infoResponse = await context.request.get(
      infoUrl,
      { headers: managerHeaders, timeout: 20_000 },
    ).catch(() => null);
    const info: unknown = infoResponse?.ok()
      ? await infoResponse.json().catch(() => null)
      : null;
    const contentHash = extractManagerContentHash(payload) || extractManagerContentHash(info);

    const candidateUrls = [
      ...(contentHash
        ? [`https://chat-content.line-scdn.net/bot/${encodeURIComponent(botId)}/${encodeURIComponent(contentHash)}`]
        : []),
      ...extractManagerMediaUrlCandidates(payload),
      ...extractManagerMediaUrlCandidates(info),
      `https://chat.line.biz/api/v1/bots/${encodeURIComponent(botId)}/messages/content/${encodeURIComponent(managerMessageId)}`,
      `https://chat.line.biz/api/v1/bots/${encodeURIComponent(botId)}/messages/content/${encodeURIComponent(managerMessageId)}/download`,
    ];

    const deduped = [...new Set(candidateUrls)];
    const attempts: Array<{
      source: "CONTENT_HASH" | "PAYLOAD_URL" | "DIRECT_CONTENT";
      status: number | null;
      mimeType: string | null;
      bodyReadable: boolean;
      formatAccepted: boolean;
    }> = [];

    for (const url of deduped) {
      const source = managerMediaCandidateKind(url, contentHash);
      const isManagerApi = url.startsWith("https://chat.line.biz/");
      const response = await context.request.get(url, {
        headers: isManagerApi ? managerHeaders : { referer },
        timeout: 20_000,
      }).catch(() => null);
      if (!response?.ok()) {
        attempts.push({
          source,
          status: response?.status() ?? null,
          mimeType: response ? normalizeMime(response.headers()["content-type"]) || null : null,
          bodyReadable: false,
          formatAccepted: false,
        });
        continue;
      }
      const mimeType = normalizeMime(response.headers()["content-type"]);
      const body = await responseBuffer(response, maxBytes).catch(() => null);
      if (!body) {
        attempts.push({
          source,
          status: response.status(),
          mimeType: mimeType || null,
          bodyReadable: false,
          formatAccepted: false,
        });
        continue;
      }
      const normalized = fileExtensionFor({ messageType, mimeType, fileName, body });
      attempts.push({
        source,
        status: response.status(),
        mimeType: mimeType || null,
        bodyReadable: true,
        formatAccepted: Boolean(normalized),
      });
      if (!normalized) continue;
      return {
        body,
        mimeType: normalized.mimeType,
        extension: normalized.extension,
        source,
      };
    }

    this.logger.warn(JSON.stringify({
      event: "line_chat_manager_media_binary_not_found",
      messageType,
      infoStatus: infoResponse?.status() ?? null,
      payloadKeys: safeJsonKeyNames(payload),
      infoKeys: safeJsonKeyNames(info),
      payloadContentHashPresent: Boolean(extractManagerContentHash(payload)),
      infoContentHashPresent: Boolean(extractManagerContentHash(info)),
      payloadUrlCandidateCount: extractManagerMediaUrlCandidates(payload).length,
      infoUrlCandidateCount: extractManagerMediaUrlCandidates(info).length,
      attempts,
    }));
    throw new Error("MANAGER_MEDIA_BINARY_NOT_FOUND");
  }

  private async downloadSticker(
    context: BrowserContext,
    payload: ManagerMessagePayload,
  ): Promise<DownloadedManagerMedia> {
    const identity = extractManagerStickerIdentity(payload);
    if (!identity.stickerId || !/^\d{1,20}$/u.test(identity.stickerId)) {
      throw new Error("MANAGER_STICKER_ID_MISSING");
    }
    const url = `https://stickershop.line-scdn.net/stickershop/v1/sticker/${encodeURIComponent(identity.stickerId)}/android/sticker.png`;
    const response = await context.request.get(url, { timeout: 20_000 }).catch(() => null);
    if (!response?.ok()) throw new Error("MANAGER_STICKER_DOWNLOAD_FAILED");
    const mimeType = normalizeMime(response.headers()["content-type"]);
    const body = await responseBuffer(response, maxBytesFor(MessageType.STICKER));
    const normalized = fileExtensionFor({
      messageType: MessageType.STICKER,
      mimeType,
      fileName: null,
      body,
    });
    if (!normalized) throw new Error("MANAGER_STICKER_MIME_UNSUPPORTED");
    return {
      body,
      mimeType: normalized.mimeType,
      extension: normalized.extension,
      source: "STICKER_CDN",
      stickerId: identity.stickerId,
      packageId: identity.packageId ?? undefined,
    };
  }

  private async markFailed(
    messageId: string,
    externalMessageId: string | null,
    messageType: MessageType,
    errorMessage: string,
  ): Promise<void> {
    if (!externalMessageId) return;
    await this.prisma.messageMedia.upsert({
      where: { messageId },
      update: {
        processingStatus: MediaProcessingStatus.FAILED,
        errorCode: errorMessage.slice(0, 80),
        errorMessage,
      },
      create: {
        messageId,
        providerMessageId: externalMessageId,
        mediaType: messageType,
        processingStatus: MediaProcessingStatus.FAILED,
        errorCode: errorMessage.slice(0, 80),
        errorMessage,
      },
    });
  }
}
