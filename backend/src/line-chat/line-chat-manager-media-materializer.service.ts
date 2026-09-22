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
import { LineChatAuthRecoveryService } from "./line-chat-auth-recovery.service";
import { LineChatHealthService } from "./line-chat-health.service";

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

type MaterializationBatchInput = {
  id: string;
  externalMessageId: string | null;
  messageType: MessageType;
  storeCode: string;
};

type MaterializationBatchResult = MaterializationBatchInput & {
  outcome: "READY" | "SKIPPED" | "ERROR";
  error?: string;
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

export function managerContentHashUrl(botId: string, contentHash: string): string | null {
  const trimmed = contentHash.trim().replace(/^\/+|\/+$/gu, "");
  if (!trimmed || /[\r\n?#]/u.test(trimmed) || trimmed.split("/").some((part) => part === "..")) {
    return null;
  }
  const encodedPath = trimmed.split("/").map((part) => encodeURIComponent(part)).join("/");
  return `https://chat-content.line-scdn.net/bot/${encodeURIComponent(botId)}/${encodedPath}`;
}

export function isTransientManagerMediaError(errorMessage: string): boolean {
  return errorMessage === "MANAGER_MEDIA_PROFILE_BUSY"
    || errorMessage.startsWith("MANAGER_MEDIA_AUTH_")
    || /\bEAGAIN\b/u.test(errorMessage)
    || /browser has been closed/iu.test(errorMessage)
    || /Failed to launch/iu.test(errorMessage)
    || /Target page, context or browser has been closed/iu.test(errorMessage)
    || /launchPersistentContext:\s*Timeout\s+\d+ms exceeded/iu.test(errorMessage);
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
      const trimmedCandidate = typeof child === "string" ? child.trim() : "";
      const looksLikeUrl = trimmedCandidate.startsWith("https://") || trimmedCandidate.startsWith("/");
      if (
        looksLikeUrl
        && /(url|uri|download|content|original|preview|thumbnail)/i.test(key)
      ) {
        try {
          const parsed = new URL(trimmedCandidate, "https://chat.line.biz");
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
    @Inject(LineChatHealthService) private readonly healthService: LineChatHealthService,
    @Inject(LineChatAuthRecoveryService) private readonly authRecovery: LineChatAuthRecoveryService,
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

      const batchInputs: MaterializationBatchInput[] = candidates.map((message) => ({
        id: message.id,
        externalMessageId: message.externalMessageId,
        messageType: message.messageType,
        storeCode: storeCodeOf(message),
      }));
      scanned = batchInputs.length;

      const results = await this.materializeMessageBatch(batchInputs);
      for (const result of results) {
        if (result.outcome === "READY") {
          ready += 1;
          this.retryNotBefore.delete(result.id);
          continue;
        }
        if (result.outcome === "SKIPPED") {
          skipped += 1;
          this.retryNotBefore.delete(result.id);
          continue;
        }

        const errorMessage = result.error ?? "MANAGER_MEDIA_UNKNOWN_FAILURE";
        if (isTransientManagerMediaError(errorMessage)) {
          deferred += 1;
          const retryDelayMs = errorMessage.startsWith("MANAGER_MEDIA_AUTH_") ? 5 * 60_000 : 30_000;
          this.retryNotBefore.set(result.id, Date.now() + retryDelayMs);
          this.logger.log(JSON.stringify({
            event: "line_chat_manager_media_materialize_deferred",
            storeCode: result.storeCode,
            messageType: result.messageType,
            reason: errorMessage,
          }));
          continue;
        }

        failed += 1;
        this.retryNotBefore.set(result.id, Date.now() + 5 * 60_000);
        await this.markFailed(result.id, result.externalMessageId, result.messageType, errorMessage).catch(() => {});
        this.logger.warn(JSON.stringify({
          event: "line_chat_manager_media_materialize_failed",
          storeCode: result.storeCode,
          messageType: result.messageType,
          error: errorMessage,
        }));
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

  private async materializeMessageBatch(
    inputs: MaterializationBatchInput[],
  ): Promise<MaterializationBatchResult[]> {
    type LoadedMessage = NonNullable<Awaited<ReturnType<LineChatManagerMediaMaterializerService["loadMessageForMaterialization"]>>>;
    const results: MaterializationBatchResult[] = [];
    const loadedGroups = new Map<string, Array<{ input: MaterializationBatchInput; message: LoadedMessage }>>();

    for (const input of inputs) {
      const message = await this.loadMessageForMaterialization(input.id);
      if (!message || !MATERIALIZABLE_TYPES.has(message.messageType)) {
        results.push({ ...input, outcome: "SKIPPED" });
        continue;
      }
      const key = message.conversation.lineOfficialAccount.id;
      const group = loadedGroups.get(key) ?? [];
      group.push({ input, message });
      loadedGroups.set(key, group);
    }

    for (const group of loadedGroups.values()) {
      results.push(...await this.materializeLoadedGroup(group));
    }

    return results;
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

  private async materializeLoadedGroup(
    group: Array<{
      input: MaterializationBatchInput;
      message: NonNullable<Awaited<ReturnType<LineChatManagerMediaMaterializerService["loadMessageForMaterialization"]>>>;
    }>,
    allowAuthRecovery = true,
  ): Promise<MaterializationBatchResult[]> {
    const first = group[0];
    if (!first) return [];

    const mirrorRows = await this.prisma.lineChatMirrorMessage.findMany({
      where: { canonicalMessageId: { in: group.map(({ message }) => message.id) } },
      select: {
        canonicalMessageId: true,
        managerMessageId: true,
        lineChatUserId: true,
        messageType: true,
      },
    });
    const mirrorsByCanonicalId = new Map(
      mirrorRows
        .filter((row) => Boolean(row.canonicalMessageId))
        .map((row) => [row.canonicalMessageId!, row]),
    );

    const runnable = group.filter(({ message }) => mirrorsByCanonicalId.has(message.id));
    const results: MaterializationBatchResult[] = group
      .filter(({ message }) => !mirrorsByCanonicalId.has(message.id))
      .map(({ input }) => ({
        ...input,
        outcome: "ERROR",
        error: "MANAGER_MEDIA_MIRROR_ROW_MISSING",
      }));
    if (runnable.length === 0) return results;

    const oa = first.message.conversation.lineOfficialAccount;
    const target = await this.mirrorService.resolveMirrorTarget({
      lineOfficialAccountId: oa.id,
      chatBotId: oa.chatBotId,
      basicId: oa.basicId,
      lineChatWorkspaceUrl: oa.lineChatWorkspaceUrl,
      storeManagerUrl: first.message.conversation.store?.storeMaster?.lineManagerUrl ?? null,
      lineChatSession: oa.lineChatSession,
    });
    if (!target.ok) {
      return results.concat(runnable.map(({ input }) => ({
        ...input,
        outcome: "ERROR",
        error: target.errorCode,
      })));
    }

    const profilePath = this.sessionService.resolveProfilePath(target.session);
    if (!fs.existsSync(profilePath)) {
      return results.concat(runnable.map(({ input }) => ({
        ...input,
        outcome: "ERROR",
        error: "MANAGER_MEDIA_PROFILE_MISSING",
      })));
    }

    try {
      const operation = await this.coordinator.withProfileOperation(
        { sessionId: target.session.id, operationKind: "MIRROR_SYNC" },
        async (operationContext) => {
          operationContext.assertOwnership();
          let context: BrowserContext | null = null;
          const operationResults: MaterializationBatchResult[] = [];
          try {
            context = await this.sessionService.launchManagedPersistentContext(
              profilePath,
              {
                profilePath,
                headless: true,
                viewport: { width: 1280, height: 800 },
                timeout: 30_000,
                args: [
                  "--no-sandbox",
                  "--disable-setuid-sandbox",
                  "--disable-blink-features=AutomationControlled",
                ],
              },
              { sessionId: target.session.id, sessionKey: target.session.sessionKey },
            );
            const page = context.pages()[0] || await context.newPage();
            const firstRunnable = runnable[0];
            if (!firstRunnable) return operationResults;
            const firstMirror = mirrorsByCanonicalId.get(firstRunnable.message.id);
            if (!firstMirror) throw new Error("MANAGER_MEDIA_MIRROR_ROW_MISSING");
            const firstReferer = this.sessionService.buildChatRefererUrl(target.botId, firstMirror.lineChatUserId);
            await page.goto(firstReferer, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
            const auth = await confirmLineManagerAuthentication(
              () => this.sessionService.probeApiAuthentication(context!),
              (ms) => page.waitForTimeout(ms),
            );
            if (auth.outcome !== "AUTHENTICATED") {
              throw new Error(`MANAGER_MEDIA_AUTH_${auth.outcome}`);
            }

            const baseHeaders = await this.managerRequestHeaders(context, firstReferer);
            for (const { input, message } of runnable) {
              operationContext.assertOwnership();
              const mirror = mirrorsByCanonicalId.get(message.id)!;
              try {
                const referer = this.sessionService.buildChatRefererUrl(target.botId, mirror.lineChatUserId);
                const managerHeaders = { ...baseHeaders, referer };
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
                await this.persistDownloadedMedia(message, mirror.managerMessageId, downloaded);
                operationResults.push({ ...input, outcome: "READY" });
              } catch (error) {
                operationResults.push({
                  ...input,
                  outcome: "ERROR",
                  error: error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240),
                });
              }
            }
            operationContext.assertOwnership();
            return operationResults;
          } finally {
            if (context) {
              await this.sessionService.closeManagedPersistentContext(context, profilePath).catch(() => {});
            }
          }
        },
        { waitForLock: true, waitForLockMs: 15_000 },
      );

      if (!operation.acquired) {
        return results.concat(runnable.map(({ input }) => ({
          ...input,
          outcome: "ERROR",
          error: "MANAGER_MEDIA_PROFILE_BUSY",
        })));
      }
      return results.concat(operation.value);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.slice(0, 240) : String(error).slice(0, 240);

      if (allowAuthRecovery && errorMessage.startsWith("MANAGER_MEDIA_AUTH_")) {
        const recovered = await this.tryRecoverExpiredManagerAuth(target.session.id, errorMessage);
        if (recovered) {
          this.logger.log(JSON.stringify({
            event: "line_chat_manager_media_auth_recovered_retrying_batch",
            storeCode: runnable[0]?.input.storeCode ?? null,
            candidateCount: runnable.length,
          }));
          return results.concat(await this.materializeLoadedGroup(runnable, false));
        }
      }

      return results.concat(runnable.map(({ input }) => ({
        ...input,
        outcome: "ERROR",
        error: errorMessage,
      })));
    }
  }

  private async tryRecoverExpiredManagerAuth(
    sessionId: string,
    errorMessage: string,
  ): Promise<boolean> {
    await this.healthService.recordSessionHealthResult({
      sessionId,
      status: "AUTH_REQUIRED",
      failureStage: "MANAGER_AUTH",
      checkedAt: new Date(),
      httpStatus: 401,
      source: "SCHEDULED",
    }).catch(() => undefined);

    if (process.env.LINE_CHAT_AUTO_AUTH_RECOVERY_ENABLED !== "true") {
      return false;
    }

    const recovery = await this.authRecovery.recoverSession(sessionId, "SCHEDULED").catch((error: unknown) => ({
      outcome: "RECOVERY_FAILED_SAFE" as const,
      message: error instanceof Error ? error.message : String(error),
    }));

    this.logger.log(JSON.stringify({
      event: "line_chat_manager_media_auth_recovery_attempted",
      sessionId,
      trigger: errorMessage,
      outcome: recovery.outcome,
    }));

    return recovery.outcome === "RECOVERED_REMEMBERED_ACCOUNT";
  }

  private async persistDownloadedMedia(
    message: NonNullable<Awaited<ReturnType<LineChatManagerMediaMaterializerService["loadMessageForMaterialization"]>>>,
    managerMessageId: string,
    downloaded: DownloadedManagerMedia,
  ): Promise<void> {
    const oa = message.conversation.lineOfficialAccount;
    const providerMessageId = `line-chat-manager:${managerMessageId}`;
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
        ? [managerContentHashUrl(botId, contentHash)].filter((value): value is string => Boolean(value))
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

    const payloadRecord = jsonRecord(payload);
    const contentProvider = payloadRecord?.contentProvider;
    const contentHashSegments = contentHash ? contentHash.split("/").filter(Boolean) : [];
    this.logger.warn(JSON.stringify({
      event: "line_chat_manager_media_binary_not_found",
      messageType,
      infoStatus: infoResponse?.status() ?? null,
      payloadKeys: safeJsonKeyNames(payload),
      infoKeys: safeJsonKeyNames(info),
      payloadExpired: typeof payloadRecord?.expired === "boolean" ? payloadRecord.expired : null,
      payloadExpiredAt: typeof payloadRecord?.expiredAt === "string"
        ? payloadRecord.expiredAt.slice(0, 64)
        : null,
      payloadContentProvider: typeof contentProvider === "string" && /^[A-Za-z0-9_-]{1,32}$/u.test(contentProvider)
        ? contentProvider
        : null,
      payloadContentHashPresent: Boolean(extractManagerContentHash(payload)),
      infoContentHashPresent: Boolean(extractManagerContentHash(info)),
      contentHashLength: contentHash?.length ?? 0,
      contentHashSegmentCount: contentHashSegments.length,
      payloadUrlCandidateCount: extractManagerMediaUrlCandidates(payload).length,
      infoUrlCandidateCount: extractManagerMediaUrlCandidates(info).length,
      candidateOrigins: [...new Set(deduped.flatMap((url) => {
        try {
          return [new URL(url).origin];
        } catch {
          return [];
        }
      }))],
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
