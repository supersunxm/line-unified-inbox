import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { LineChatSessionStatus } from "@prisma/client";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import * as fs from "node:fs";
import { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import {
  getLineChatManagerRelayStoreConfig,
  isLineChatManagerRelayStoreEnabled,
} from "./line-chat-pilot.constants";
import type { ManagerRelayResult } from "./line-chat-manager-message-relay.service";

const RELAY_DEDUPE_TTL_MS = 15 * 60_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const SEND_BUTTON_SELECTORS = [
  'button[aria-label*="send" i]',
  '[role="button"][aria-label*="send" i]',
  'button[aria-label*="ส่ง"]',
  '[role="button"][aria-label*="ส่ง"]',
  'button:has-text("Send")',
  'button:has-text("ส่ง")',
] as const;

type RelayConversation = {
  id: string;
  storeId: string | null;
  lineOfficialAccountId: string;
  lineChatUserId: string | null;
  store: {
    code: string | null;
    storeMaster: { externalStoreId: string | null } | null;
  } | null;
  lineOfficialAccount: {
    id: string;
    name: string;
    storeId: string | null;
    accountType: string;
    isActive: boolean;
    archivedAt: Date | null;
    chatBotId: string | null;
    lineChatSession: {
      id: string;
      sessionKey: string;
      profilePath: string | null;
      profileStorageKey: string | null;
      status: LineChatSessionStatus;
    } | null;
  };
};

function storeCodeOf(conversation: RelayConversation): string {
  return conversation.store?.code?.trim()
    || conversation.store?.storeMaster?.externalStoreId?.trim()
    || "";
}

function detectMime(buffer: Buffer): string | null {
  if (buffer.subarray(0, 2).equals(Buffer.from([0xff, 0xd8]))) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (buffer.subarray(0, 3).toString() === "GIF") return "image/gif";
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

function extensionFor(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/gif") return "gif";
  return "webp";
}

@Injectable()
export class LineChatManagerImageRelayWorkerService {
  private readonly logger = new Logger(LineChatManagerImageRelayWorkerService.name);
  private readonly completed = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<ManagerRelayResult>>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatRecentResolverService) private readonly recentResolver: LineChatRecentResolverService,
    @Inject(LineChatProfileOperationCoordinator) private readonly coordinator: LineChatProfileOperationCoordinator,
  ) {}

  public async relayImage(input: {
    conversationId: string;
    imageUrl: string;
    idempotencyKey: string;
  }): Promise<ManagerRelayResult> {
    const conversation = await this.loadConversation(input.conversationId.trim());
    if (!conversation) return { handled: false };

    const storeCode = storeCodeOf(conversation);
    if (!isLineChatManagerRelayStoreEnabled(storeCode)) return { handled: false };
    this.assertRelayConfiguration(conversation, storeCode);
    this.pruneCompleted();

    const dedupeKey = `${conversation.id}:image:${input.idempotencyKey}`;
    if (this.completed.has(dedupeKey)) {
      return {
        handled: true,
        duplicate: true,
        lineChatUserId: conversation.lineChatUserId?.trim() || "resolved-on-prior-attempt",
      };
    }
    const existing = this.inFlight.get(dedupeKey);
    if (existing) {
      const result = await existing;
      return result.handled ? { ...result, duplicate: true } : result;
    }

    const operation = this.executeRelay(conversation, storeCode, input.imageUrl, dedupeKey);
    this.inFlight.set(dedupeKey, operation);
    try {
      return await operation;
    } finally {
      this.inFlight.delete(dedupeKey);
    }
  }

  private async executeRelay(
    conversation: RelayConversation,
    storeCode: string,
    imageUrl: string,
    dedupeKey: string,
  ): Promise<ManagerRelayResult> {
    const oa = conversation.lineOfficialAccount;
    const session = oa.lineChatSession!;
    const botId = oa.chatBotId!.trim();
    const profilePath = this.sessionService.resolveProfilePath(session);
    let lineChatUserId = conversation.lineChatUserId?.trim() || "";

    if (!lineChatUserId) {
      const resolution = await this.coordinator.withProfileOperation(
        { sessionId: session.id, operationKind: "RECENT_RESOLUTION" },
        (operationContext) => this.recentResolver.resolve({
          conversationId: conversation.id,
          lineOfficialAccountId: oa.id,
          botId,
          sessionKey: session.sessionKey,
          profilePath,
          operationContext,
        }),
      );
      if (!resolution.acquired) {
        throw new ServiceUnavailableException("LINE OA Manager กำลังทำงานอื่นอยู่ กรุณาลองส่งอีกครั้งในอีกสักครู่");
      }
      if (resolution.value.status !== "RESOLVED") {
        throw new ServiceUnavailableException(
          `ยังจับคู่ลูกค้ากับ LINE OA Manager ไม่สำเร็จ (${resolution.value.status}) กรุณาลองอีกครั้งหลังลูกค้าส่งข้อความใหม่`,
        );
      }
      lineChatUserId = resolution.value.lineChatUserId;
    }

    const image = await this.downloadImage(imageUrl);
    const sendOperation = await this.coordinator.withProfileOperation(
      { sessionId: session.id, operationKind: "MANUAL_DIAGNOSTIC" },
      async (operationContext) => {
        operationContext.assertOwnership();
        await this.sendViaManager({
          storeCode,
          botId,
          lineChatUserId,
          profilePath,
          image,
        });
        operationContext.assertOwnership();
      },
    );
    if (!sendOperation.acquired) {
      throw new ServiceUnavailableException("LINE OA Manager กำลังทำงานอื่นอยู่ กรุณาลองส่งอีกครั้งในอีกสักครู่");
    }

    this.completed.set(dedupeKey, Date.now());
    this.logger.log(JSON.stringify({
      event: "line_chat_manager_image_relay_success",
      storeCode,
      conversationId: conversation.id,
      lineOfficialAccountId: oa.id,
      sessionKey: session.sessionKey,
      mimeType: image.mimeType,
      fileSize: image.buffer.length,
    }));
    return { handled: true, duplicate: false, lineChatUserId };
  }

  private async downloadImage(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    let parsed: URL;
    try {
      parsed = new URL(imageUrl);
    } catch {
      throw new ServiceUnavailableException("URL รูปภาพไม่ถูกต้อง จึงยกเลิกการส่งผ่าน LINE OA Manager");
    }
    if (parsed.protocol !== "https:") {
      throw new ServiceUnavailableException("รูปภาพสำหรับ LINE OA Manager ต้องใช้ HTTPS");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(parsed, { signal: controller.signal });
      if (!response.ok) throw new Error(`IMAGE_FETCH_${response.status}`);
      const lengthHeader = Number(response.headers.get("content-length") || "0");
      if (lengthHeader > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error("IMAGE_TOO_LARGE");
      const mimeType = detectMime(buffer);
      if (!mimeType || !SUPPORTED_MIME.has(mimeType)) throw new Error("UNSUPPORTED_IMAGE");
      return {
        buffer,
        mimeType,
        filename: `image-${Date.now()}.${extensionFor(mimeType)}`,
      };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const code = error instanceof Error ? error.message : "IMAGE_FETCH_FAILED";
      this.logger.warn(JSON.stringify({ event: "line_chat_manager_image_download_failed", code }));
      throw new ServiceUnavailableException("เตรียมรูปภาพสำหรับส่งผ่าน LINE OA Manager ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async sendViaManager(input: {
    storeCode: string;
    botId: string;
    lineChatUserId: string;
    profilePath: string;
    image: { buffer: Buffer; mimeType: string; filename: string };
  }): Promise<void> {
    if (!fs.existsSync(input.profilePath)) {
      throw new ServiceUnavailableException(`ไม่พบ session ของ LINE OA Manager ร้าน ${input.storeCode} กรุณา login ใหม่`);
    }

    let context: BrowserContext | null = null;
    try {
      context = await chromium.launchPersistentContext(input.profilePath, {
        headless: true,
        viewport: { width: 1280, height: 800 },
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
      });
      const page = context.pages()[0] || await context.newPage();
      const targetUrl = this.sessionService.buildChatRefererUrl(input.botId, input.lineChatUserId);
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const auth = await this.sessionService.probeApiAuthentication(context);
      if (auth.authenticated !== "YES") {
        throw new ServiceUnavailableException(`session ของ LINE OA Manager ร้าน ${input.storeCode} หมดอายุ กรุณา login ใหม่`);
      }

      const fileInput = await this.findImageInput(page);
      if (!fileInput) {
        throw new ServiceUnavailableException("ไม่พบปุ่มแนบรูปใน LINE OA Manager กรุณาตรวจสอบหน้า chat.line.biz");
      }

      const beforeImages = await this.countVisibleImages(page);
      await fileInput.setInputFiles({
        name: input.image.filename,
        mimeType: input.image.mimeType,
        buffer: input.image.buffer,
      });

      const previewReady = await this.waitForPreview(page, fileInput, beforeImages);
      if (!previewReady) {
        throw new ServiceUnavailableException("LINE OA Manager ไม่แสดงตัวอย่างรูปก่อนส่ง จึงยกเลิกเพื่อป้องกันการส่งผิดห้อง");
      }

      const sendButton = await this.findSendButton(page);
      if (!sendButton) {
        throw new ServiceUnavailableException("ไม่พบปุ่มส่งรูปใน LINE OA Manager");
      }
      await sendButton.click({ timeout: 5_000 });

      const verified = await this.waitForDeliveryVerification(page, fileInput, beforeImages);
      if (!verified) {
        throw new ServiceUnavailableException("ยังยืนยันการส่งรูปจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกว่าส่งสำเร็จ");
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(JSON.stringify({
        event: "line_chat_manager_image_relay_failed",
        storeCode: input.storeCode,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw new ServiceUnavailableException("ส่งรูปผ่าน LINE OA Manager ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  private async findImageInput(page: Page): Promise<Locator | null> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      for (const frame of page.frames()) {
        const inputs = frame.locator('input[type="file"]');
        const count = Math.min(await inputs.count().catch(() => 0), 8);
        for (let i = 0; i < count; i += 1) {
          const input = inputs.nth(i);
          const accept = (await input.getAttribute("accept").catch(() => ""))?.toLowerCase() || "";
          if (!accept || accept.includes("image") || accept.includes("jpg") || accept.includes("png")) return input;
        }
      }
      await page.waitForTimeout(250);
    }
    return null;
  }

  private async findSendButton(page: Page): Promise<Locator | null> {
    for (const frame of page.frames()) {
      for (const selector of SEND_BUTTON_SELECTORS) {
        const matches = frame.locator(selector);
        const count = Math.min(await matches.count().catch(() => 0), 8);
        for (let i = count - 1; i >= 0; i -= 1) {
          const candidate = matches.nth(i);
          if (!(await candidate.isVisible().catch(() => false))) continue;
          if (!(await candidate.isEnabled().catch(() => false))) continue;
          const box = await candidate.boundingBox().catch(() => null);
          const viewportHeight = page.viewportSize()?.height ?? 800;
          if (box && box.y + box.height / 2 >= viewportHeight * 0.55) return candidate;
        }
      }
    }
    return null;
  }

  private async countVisibleImages(page: Page): Promise<number> {
    let total = 0;
    for (const frame of page.frames()) {
      const images = frame.locator("img");
      const count = Math.min(await images.count().catch(() => 0), 250);
      for (let i = 0; i < count; i += 1) {
        if (await images.nth(i).isVisible().catch(() => false)) total += 1;
      }
    }
    return total;
  }

  private async waitForPreview(page: Page, fileInput: Locator, beforeImages: number): Promise<boolean> {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      const filesCount = await fileInput.evaluate((element: HTMLInputElement) => element.files?.length ?? 0).catch(() => 0);
      const currentImages = await this.countVisibleImages(page);
      if (filesCount > 0 && currentImages > beforeImages) return true;
      await page.waitForTimeout(250);
    }
    return false;
  }

  private async waitForDeliveryVerification(page: Page, fileInput: Locator, beforeImages: number): Promise<boolean> {
    const deadline = Date.now() + 12_000;
    while (Date.now() < deadline) {
      const filesCount = await fileInput.evaluate((element: HTMLInputElement) => element.files?.length ?? 0).catch(() => 0);
      const currentImages = await this.countVisibleImages(page);
      if (filesCount === 0 && currentImages > beforeImages) return true;
      await page.waitForTimeout(300);
    }
    return false;
  }

  private async loadConversation(id: string): Promise<RelayConversation | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        storeId: true,
        lineOfficialAccountId: true,
        lineChatUserId: true,
        store: { select: { code: true, storeMaster: { select: { externalStoreId: true } } } },
        lineOfficialAccount: {
          select: {
            id: true,
            name: true,
            storeId: true,
            accountType: true,
            isActive: true,
            archivedAt: true,
            chatBotId: true,
            lineChatSession: {
              select: {
                id: true,
                sessionKey: true,
                profilePath: true,
                profileStorageKey: true,
                status: true,
              },
            },
          },
        },
      },
    }) as Promise<RelayConversation | null>;
  }

  private assertRelayConfiguration(conversation: RelayConversation, storeCode: string): void {
    const oa = conversation.lineOfficialAccount;
    const session = oa.lineChatSession;
    const config = getLineChatManagerRelayStoreConfig(storeCode);
    if (
      !config
      || conversation.storeId !== oa.storeId
      || oa.accountType !== "STORE"
      || !oa.isActive
      || oa.archivedAt !== null
      || oa.name.trim() !== config.storeName
      || !oa.chatBotId?.trim()
      || ("expectedBotId" in config && oa.chatBotId.trim() !== config.expectedBotId)
      || !session
      || session.sessionKey.trim() !== config.sessionKey
      || session.status !== LineChatSessionStatus.ACTIVE
    ) {
      throw new ServiceUnavailableException(
        `การตั้งค่า LINE OA Manager ของร้าน ${storeCode} ไม่พร้อมใช้งาน จึงยกเลิกการส่งรูปเพื่อป้องกันการใช้ Push quota`,
      );
    }
  }

  private pruneCompleted(): void {
    const threshold = Date.now() - RELAY_DEDUPE_TTL_MS;
    for (const [key, completedAt] of this.completed.entries()) {
      if (completedAt < threshold) this.completed.delete(key);
    }
  }
}
