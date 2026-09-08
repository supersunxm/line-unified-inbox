import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { LineChatSessionStatus } from "@prisma/client";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import * as fs from "node:fs";
import { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { confirmLineManagerAuthentication } from "./line-chat-manager-auth-confirmation";
import {
  getLineChatManagerRelayStoreConfig,
  isLineChatManagerRelayStoreEnabled,
} from "./line-chat-pilot.constants";
import type { ManagerRelayResult } from "./line-chat-manager-message-relay.service";

const RELAY_DEDUPE_TTL_MS = 15 * 60_000;
const COMPOSER_WAIT_MS = 12_000;
const COMPOSER_SELECTORS = [
  'textarea[placeholder*="Enter" i]',
  'textarea[placeholder*="Send" i]',
  'textarea[placeholder*="message" i]',
  'textarea[placeholder*="ส่ง"]',
  '[contenteditable="true"][role="textbox"]',
  '[role="textbox"][contenteditable]:not([contenteditable="false"])',
  '.ProseMirror[contenteditable="true"]',
  '[data-placeholder*="Send" i][contenteditable="true"]',
  '[data-placeholder*="message" i][contenteditable="true"]',
  '[aria-label*="Send" i][contenteditable="true"]',
  '[aria-label*="message" i][contenteditable="true"]',
  '[contenteditable="true"]',
  '[role="textbox"]',
  'textarea',
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

type ComposerCandidate = {
  locator: Locator;
  score: number;
};

function storeCodeOf(conversation: RelayConversation): string {
  return conversation.store?.code?.trim()
    || conversation.store?.storeMaster?.externalStoreId?.trim()
    || "";
}

@Injectable()
export class LineChatManagerMessageRelayWorkerService {
  private readonly logger = new Logger(LineChatManagerMessageRelayWorkerService.name);
  private readonly completed = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<ManagerRelayResult>>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatRecentResolverService) private readonly recentResolver: LineChatRecentResolverService,
    @Inject(LineChatProfileOperationCoordinator) private readonly coordinator: LineChatProfileOperationCoordinator,
  ) {}

  public async relayText(input: {
    conversationId: string;
    text: string;
    idempotencyKey: string;
  }): Promise<ManagerRelayResult> {
    const conversation = await this.loadConversation(input.conversationId.trim());
    if (!conversation) return { handled: false };

    const storeCode = storeCodeOf(conversation);
    if (!isLineChatManagerRelayStoreEnabled(storeCode)) return { handled: false };

    this.assertRelayConfiguration(conversation, storeCode);
    this.pruneCompleted();

    const dedupeKey = `${conversation.id}:${input.idempotencyKey}`;
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

    const operation = this.executeRelay(conversation, storeCode, input.text, dedupeKey);
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
    text: string,
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

    const sendOperation = await this.coordinator.withProfileOperation(
      { sessionId: session.id, operationKind: "MANUAL_DIAGNOSTIC" },
      async (operationContext) => {
        operationContext.assertOwnership();
        await this.sendViaManager({ storeCode, botId, lineChatUserId, profilePath, text });
        operationContext.assertOwnership();
      },
    );
    if (!sendOperation.acquired) {
      throw new ServiceUnavailableException("LINE OA Manager กำลังทำงานอื่นอยู่ กรุณาลองส่งอีกครั้งในอีกสักครู่");
    }

    this.completed.set(dedupeKey, Date.now());
    this.logger.log(JSON.stringify({
      event: "line_chat_manager_message_relay_success",
      storeCode,
      conversationId: conversation.id,
      lineOfficialAccountId: oa.id,
      sessionKey: session.sessionKey,
      lineChatUserIdMasked: `${lineChatUserId.slice(0, 4)}...${lineChatUserId.slice(-4)}`,
    }));
    return { handled: true, duplicate: false, lineChatUserId };
  }

  private async loadConversation(id: string): Promise<RelayConversation | null> {
    return this.prisma.conversation.findUnique({
      where: { id },
      select: {
        id: true,
        storeId: true,
        lineOfficialAccountId: true,
        lineChatUserId: true,
        store: {
          select: {
            code: true,
            storeMaster: { select: { externalStoreId: true } },
          },
        },
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
        `การตั้งค่า LINE OA Manager ของร้าน ${storeCode} ไม่พร้อมใช้งาน จึงยกเลิกการส่งเพื่อป้องกันการใช้ Push quota`,
      );
    }
  }

  private async sendViaManager(input: {
    storeCode: string;
    botId: string;
    lineChatUserId: string;
    profilePath: string;
    text: string;
  }): Promise<void> {
    if (!fs.existsSync(input.profilePath)) {
      throw new ServiceUnavailableException(`ไม่พบ session ของ LINE OA Manager ร้าน ${input.storeCode} กรุณา login ใหม่`);
    }

    let context: BrowserContext | null = null;
    try {
      context = await chromium.launchPersistentContext(input.profilePath, {
        headless: true,
        viewport: { width: 1280, height: 800 },
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-blink-features=AutomationControlled",
        ],
      });
      const page = context.pages()[0] || await context.newPage();
      const targetUrl = this.sessionService.buildChatRefererUrl(input.botId, input.lineChatUserId);
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});

      const auth = await confirmLineManagerAuthentication(
        () => this.sessionService.probeApiAuthentication(context!),
        (ms) => page.waitForTimeout(ms),
      );
      if (auth.outcome === "AUTH_EXPIRED") {
        throw new ServiceUnavailableException(`session ของ LINE OA Manager ร้าน ${input.storeCode} หมดอายุ กรุณา login ใหม่`);
      }
      if (auth.outcome === "INCONCLUSIVE") {
        this.logger.warn(JSON.stringify({
          event: "line_chat_manager_message_auth_inconclusive",
          storeCode: input.storeCode,
          attempts: auth.attempts,
          observations: auth.observations,
        }));
        throw new ServiceUnavailableException("ยังยืนยันสถานะการเข้าสู่ระบบ LINE OA Manager ไม่ได้ กรุณาลองส่งอีกครั้ง");
      }

      const composer = await this.findComposer(page, COMPOSER_WAIT_MS);
      if (!composer) {
        await this.logComposerDiagnostics(page, input.storeCode, input.lineChatUserId);
        throw new ServiceUnavailableException("ไม่พบช่องพิมพ์ข้อความใน LINE OA Manager กรุณาตรวจสอบหน้า chat.line.biz");
      }

      const beforeCount = await this.countExactText(page, input.text);
      await composer.click({ timeout: 3_000 }).catch(() => {});
      try {
        await composer.fill(input.text);
      } catch {
        await composer.click();
        await page.keyboard.insertText(input.text);
      }
      await composer.press("Enter");

      const verified = await this.waitForDeliveryVerification(page, composer, input.text, beforeCount);
      if (!verified) {
        throw new ServiceUnavailableException("ยังยืนยันการส่งจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกข้อความว่าส่งสำเร็จ");
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(JSON.stringify({
        event: "line_chat_manager_message_relay_failed",
        storeCode: input.storeCode,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw new ServiceUnavailableException("ส่งผ่าน LINE OA Manager ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  private async findComposer(page: Page, waitMs: number): Promise<Locator | null> {
    const deadline = Date.now() + waitMs;
    while (Date.now() < deadline) {
      const candidates: ComposerCandidate[] = [];
      for (const frame of page.frames()) {
        const viewportHeight = page.viewportSize()?.height ?? 800;
        for (const selector of COMPOSER_SELECTORS) {
          const matches = frame.locator(selector);
          const count = Math.min(await matches.count().catch(() => 0), 12);
          for (let i = 0; i < count; i += 1) {
            const candidate = matches.nth(i);
            if (!(await candidate.isVisible().catch(() => false))) continue;
            if (!(await candidate.isEnabled().catch(() => true))) continue;

            const metadata = await candidate.evaluate((element) => ({
              tag: element.tagName.toLowerCase(),
              role: element.getAttribute("role")?.toLowerCase() ?? "",
              placeholder: element.getAttribute("placeholder")?.toLowerCase() ?? "",
              ariaLabel: element.getAttribute("aria-label")?.toLowerCase() ?? "",
              dataPlaceholder: element.getAttribute("data-placeholder")?.toLowerCase() ?? "",
              contentEditable: element.getAttribute("contenteditable")?.toLowerCase() ?? "",
              className: typeof element.className === "string" ? element.className.toLowerCase() : "",
            })).catch(() => null);
            if (!metadata) continue;

            const box = await candidate.boundingBox().catch(() => null);
            let score = 0;
            if (box && box.y + box.height / 2 >= viewportHeight * 0.55) score += 6;
            if (box && box.y + box.height / 2 >= viewportHeight * 0.72) score += 3;
            if (metadata.tag === "textarea") score += 2;
            if (metadata.role === "textbox") score += 2;
            if (metadata.contentEditable === "true") score += 2;
            if (metadata.className.includes("prosemirror")) score += 3;
            const hint = `${metadata.placeholder} ${metadata.ariaLabel} ${metadata.dataPlaceholder}`;
            if (/send|message|enter|ส่ง/u.test(hint)) score += 5;
            if (/search|ค้นหา/u.test(hint)) score -= 10;

            const strongSemantic = /send|message|enter|ส่ง/u.test(hint)
              && (metadata.tag === "textarea" || metadata.role === "textbox" || metadata.contentEditable === "true");
            const lowerPane = Boolean(box && box.y + box.height / 2 >= viewportHeight * 0.55);
            if (!lowerPane && !strongSemantic) continue;
            candidates.push({ locator: candidate, score });
          }
        }
      }

      candidates.sort((a, b) => b.score - a.score || 0);
      if (candidates[0] && candidates[0].score >= 5) return candidates[0].locator;
      await page.waitForTimeout(300);
    }
    return null;
  }

  private async countExactText(page: Page, text: string): Promise<number> {
    let total = 0;
    for (const frame of page.frames()) {
      total += await frame.getByText(text, { exact: true }).count().catch(() => 0);
    }
    return total;
  }

  private async waitForDeliveryVerification(
    page: Page,
    composer: Locator,
    text: string,
    beforeCount: number,
  ): Promise<boolean> {
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const count = await this.countExactText(page, text);
      let composerCleared = false;
      try {
        composerCleared = (await composer.inputValue()) === "";
      } catch {
        composerCleared = ((await composer.textContent().catch(() => "")) ?? "").trim() === "";
      }
      if (composerCleared && count > beforeCount) return true;
      await page.waitForTimeout(250);
    }
    return false;
  }

  private async logComposerDiagnostics(page: Page, storeCode: string, lineChatUserId: string): Promise<void> {
    let pathname = "unknown";
    try { pathname = new URL(page.url()).pathname; } catch { /* safe fallback */ }
    const frameCounts = await Promise.all(page.frames().map(async (frame) => ({
      textareas: await frame.locator("textarea").count().catch(() => -1),
      contenteditables: await frame.locator('[contenteditable="true"]').count().catch(() => -1),
      roleTextboxes: await frame.locator('[role="textbox"]').count().catch(() => -1),
      proseMirrors: await frame.locator(".ProseMirror").count().catch(() => -1),
    })));
    this.logger.warn(JSON.stringify({
      event: "line_chat_manager_composer_not_found",
      storeCode,
      pathname,
      frameCount: page.frames().length,
      frameCounts,
      targetChatIdMasked: `${lineChatUserId.slice(0, 4)}...${lineChatUserId.slice(-4)}`,
    }));
  }

  private pruneCompleted(): void {
    const threshold = Date.now() - RELAY_DEDUPE_TTL_MS;
    for (const [key, timestamp] of this.completed) {
      if (timestamp < threshold) this.completed.delete(key);
    }
  }
}
