import { Inject, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { LineChatSessionStatus } from "@prisma/client";
import { chromium, type BrowserContext, type Locator, type Page } from "playwright";
import * as fs from "node:fs";
import { PrismaService } from "../prisma.service";
import { LineChatSessionService } from "./line-chat-session.service";
import { LineChatRecentResolverService } from "./line-chat-recent-resolver.service";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import {
  LINE_CHAT_PILOT_BOT_ID,
  LINE_CHAT_PILOT_OA_NAME,
  LINE_CHAT_PILOT_SESSION_KEY,
  LINE_CHAT_PILOT_STORE_CODE,
} from "./line-chat-pilot.constants";
import type { ManagerRelayResult } from "./line-chat-manager-message-relay.service";

const RELAY_DEDUPE_TTL_MS = 15 * 60_000;
const COMPOSER_SELECTORS = [
  'textarea[placeholder*="Enter: Send message"]',
  'textarea[placeholder*="Send message"]',
  'textarea[placeholder*="ส่งข้อความ"]',
  '[contenteditable="true"][role="textbox"]',
  '[contenteditable="true"]',
  'textarea',
] as const;

type PilotConversation = {
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

function storeCodeOf(conversation: PilotConversation): string {
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
    if (storeCodeOf(conversation) !== LINE_CHAT_PILOT_STORE_CODE) return { handled: false };

    this.assertPilotConfiguration(conversation);
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

    const operation = this.executePilotRelay(conversation, input.text, dedupeKey);
    this.inFlight.set(dedupeKey, operation);
    try {
      return await operation;
    } finally {
      this.inFlight.delete(dedupeKey);
    }
  }

  private async executePilotRelay(
    conversation: PilotConversation,
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
        await this.sendViaManager({ botId, lineChatUserId, profilePath, text });
        operationContext.assertOwnership();
      },
    );
    if (!sendOperation.acquired) {
      throw new ServiceUnavailableException("LINE OA Manager กำลังทำงานอื่นอยู่ กรุณาลองส่งอีกครั้งในอีกสักครู่");
    }

    this.completed.set(dedupeKey, Date.now());
    this.logger.log(JSON.stringify({
      event: "line_chat_manager_message_relay_success",
      storeCode: LINE_CHAT_PILOT_STORE_CODE,
      conversationId: conversation.id,
      lineOfficialAccountId: oa.id,
      sessionKey: session.sessionKey,
      lineChatUserIdMasked: `${lineChatUserId.slice(0, 4)}...${lineChatUserId.slice(-4)}`,
    }));
    return { handled: true, duplicate: false, lineChatUserId };
  }

  private async loadConversation(id: string): Promise<PilotConversation | null> {
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
    }) as Promise<PilotConversation | null>;
  }

  private assertPilotConfiguration(conversation: PilotConversation): void {
    const oa = conversation.lineOfficialAccount;
    const session = oa.lineChatSession;
    if (
      conversation.storeId !== oa.storeId
      || oa.accountType !== "STORE"
      || !oa.isActive
      || oa.archivedAt !== null
      || oa.name.trim() !== LINE_CHAT_PILOT_OA_NAME
      || oa.chatBotId?.trim() !== LINE_CHAT_PILOT_BOT_ID
      || !session
      || session.sessionKey.trim() !== LINE_CHAT_PILOT_SESSION_KEY
      || session.status !== LineChatSessionStatus.ACTIVE
    ) {
      throw new ServiceUnavailableException(
        "การตั้งค่า LINE OA Manager ของร้านชลบุรีไม่พร้อมใช้งาน จึงยกเลิกการส่งเพื่อป้องกันการใช้ Push quota",
      );
    }
  }

  private async sendViaManager(input: {
    botId: string;
    lineChatUserId: string;
    profilePath: string;
    text: string;
  }): Promise<void> {
    if (!fs.existsSync(input.profilePath)) {
      throw new ServiceUnavailableException("ไม่พบ session ของ LINE OA Manager ร้านชลบุรี กรุณา login ใหม่");
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
      await page.waitForTimeout(900);

      const auth = await this.sessionService.probeApiAuthentication(context);
      if (auth.authenticated !== "YES") {
        throw new ServiceUnavailableException("session ของ LINE OA Manager ร้านชลบุรีหมดอายุ กรุณา login ใหม่");
      }

      const composer = await this.findComposer(page);
      if (!composer) {
        throw new ServiceUnavailableException("ไม่พบช่องพิมพ์ข้อความใน LINE OA Manager กรุณาตรวจสอบหน้า chat.line.biz");
      }

      const exactText = page.getByText(input.text, { exact: true });
      const beforeCount = await exactText.count().catch(() => 0);
      await composer.fill(input.text);
      await composer.press("Enter");

      const verified = await this.waitForDeliveryVerification(page, composer, exactText, beforeCount);
      if (!verified) {
        throw new ServiceUnavailableException("ยังยืนยันการส่งจาก LINE OA Manager ไม่ได้ จึงไม่บันทึกข้อความว่าส่งสำเร็จ");
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      this.logger.error(JSON.stringify({
        event: "line_chat_manager_message_relay_failed",
        storeCode: LINE_CHAT_PILOT_STORE_CODE,
        error: error instanceof Error ? error.message : String(error),
      }));
      throw new ServiceUnavailableException("ส่งผ่าน LINE OA Manager ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      if (context) await context.close().catch(() => {});
    }
  }

  private async findComposer(page: Page): Promise<Locator | null> {
    const viewportHeight = page.viewportSize()?.height ?? 800;
    for (const selector of COMPOSER_SELECTORS) {
      const matches = page.locator(selector);
      const count = await matches.count().catch(() => 0);
      for (let i = 0; i < count; i += 1) {
        const candidate = matches.nth(i);
        if (!(await candidate.isVisible().catch(() => false))) continue;
        const box = await candidate.boundingBox().catch(() => null);
        if (box && box.y + box.height / 2 < viewportHeight * 0.55) continue;
        return candidate;
      }
    }
    return null;
  }

  private async waitForDeliveryVerification(
    page: Page,
    composer: Locator,
    exactText: Locator,
    beforeCount: number,
  ): Promise<boolean> {
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      const count = await exactText.count().catch(() => beforeCount);
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

  private pruneCompleted(): void {
    const threshold = Date.now() - RELAY_DEDUPE_TTL_MS;
    for (const [key, timestamp] of this.completed) {
      if (timestamp < threshold) this.completed.delete(key);
    }
  }
}
