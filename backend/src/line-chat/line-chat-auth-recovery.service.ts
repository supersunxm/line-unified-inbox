import { Inject, Injectable, Logger, NotFoundException } from "@nestjs/common";
import * as fs from "node:fs";
import { PrismaService } from "../prisma.service";
import { LineChatSessionStatus, LineChatSessionHealthStatus } from "@prisma/client";
import { LineChatHealthService } from "./line-chat-health.service";
import type {
  LineChatHealthEventSource,
  LineChatHealthFailureStage,
} from "./line-chat-health.types";
import { LineChatProfileOperationCoordinator } from "./line-chat-profile-operation-coordinator.service";
import { LineChatSessionService, type ContextLauncher } from "./line-chat-session.service";
import { isLoginLikeNavigationUrl } from "./line-chat-diagnostic-metadata";
import type { BrowserContext, Page } from "playwright";

export type LineChatAuthRecoveryOutcome =
  | "NOT_REQUIRED"
  | "RECOVERED_REMEMBERED_ACCOUNT"
  | "MANUAL_REAUTH_REQUIRED"
  | "RECOVERY_SKIPPED_ACTIVE_LEASE"
  | "RECOVERY_ALREADY_IN_PROGRESS"
  | "RECOVERY_SKIPPED_COOLDOWN"
  | "RECOVERY_TIMEOUT"
  | "RECOVERY_FAILED_SAFE";

export interface LineChatAuthRecoveryResult {
  outcome: LineChatAuthRecoveryOutcome;
  sessionId: string;
  sessionKey: string;
  durationMs: number;
  message: string;
  failureStage?: LineChatHealthFailureStage | null;
  mappedOaCount?: number;
}

export const DEFAULT_AUTH_RECOVERY_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes

function boundedDurationMs(startedAt: number): number {
  const elapsed = Date.now() - startedAt;
  if (!Number.isFinite(elapsed) || elapsed < 0) return 0;
  return Math.min(86_400_000, Math.floor(elapsed));
}

@Injectable()
export class LineChatAuthRecoveryService {
  private readonly logger = new Logger(LineChatAuthRecoveryService.name);
  private readonly inProgress = new Set<string>();
  private readonly lastAttemptAt = new Map<string, number>();

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LineChatSessionService) private readonly sessionService: LineChatSessionService,
    @Inject(LineChatProfileOperationCoordinator)
    private readonly profileCoordinator: LineChatProfileOperationCoordinator,
    @Inject(LineChatHealthService) private readonly healthService: LineChatHealthService,
  ) {}

  public isRecoveryInProgress(sessionId: string): boolean {
    return this.inProgress.has(sessionId);
  }

  public getCooldownRemainingMs(sessionId: string, cooldownMs = DEFAULT_AUTH_RECOVERY_COOLDOWN_MS): number {
    const last = this.lastAttemptAt.get(sessionId);
    if (!last) return 0;
    const elapsed = Date.now() - last;
    return Math.max(0, cooldownMs - elapsed);
  }

  public resetCooldown(sessionId: string): void {
    this.lastAttemptAt.delete(sessionId);
  }

  /**
   * Attempts safe lightweight re-authentication recovery for a session in AUTH_REQUIRED at MANAGER_AUTH.
   * Interacts only with deterministic non-sensitive UI (clicks "LINE account" -> clicks remembered account "Log in").
   * Strictly halts and sets MANUAL_REAUTH_REQUIRED upon any challenge (password, QR, OTP, 2FA, ambiguous accounts).
   */
  public async recoverSession(
    sessionId: string,
    source: LineChatHealthEventSource = "SCHEDULED",
    options: {
      bypassCooldown?: boolean;
      customLauncher?: ContextLauncher;
      cooldownMs?: number;
    } = {},
  ): Promise<LineChatAuthRecoveryResult> {
    const startedAt = Date.now();
    const cooldownMs = options.cooldownMs ?? DEFAULT_AUTH_RECOVERY_COOLDOWN_MS;

    const session = await this.prisma.lineChatSession.findUnique({
      where: { id: sessionId },
      include: {
        lineOfficialAccounts: {
          where: { isActive: true, archivedAt: null, chatBotId: { not: null } },
          select: { id: true, chatBotId: true },
        },
      },
    });

    if (!session) {
      throw new NotFoundException(`Line chat session "${sessionId}" not found.`);
    }

    const sessionKey = session.sessionKey;
    const mappedOaCount = session.lineOfficialAccounts.length;

    // Trigger condition 1: Session must be ACTIVE and in AUTH_REQUIRED at MANAGER_AUTH
    const isAuthRequired =
      session.status === LineChatSessionStatus.ACTIVE &&
      session.healthStatus === LineChatSessionHealthStatus.AUTH_REQUIRED &&
      session.healthFailureStage === "MANAGER_AUTH";

    if (!isAuthRequired) {
      this.logger.log(
        JSON.stringify({
          event: "line_chat_auth_recovery_skipped",
          sessionId,
          sessionKey,
          outcome: "NOT_REQUIRED",
          reason: "SESSION_NOT_AUTH_REQUIRED_AT_MANAGER_AUTH",
          durationMs: boundedDurationMs(startedAt),
        }),
      );
      return {
        outcome: "NOT_REQUIRED",
        sessionId,
        sessionKey,
        durationMs: boundedDurationMs(startedAt),
        message: "Session is not in ACTIVE / AUTH_REQUIRED / MANAGER_AUTH state.",
        mappedOaCount,
      };
    }

    // Trigger condition 2: No existing auth recovery in progress locally
    if (this.inProgress.has(sessionId)) {
      this.logger.warn(
        JSON.stringify({
          event: "line_chat_auth_recovery_skipped",
          sessionId,
          sessionKey,
          outcome: "RECOVERY_ALREADY_IN_PROGRESS",
          durationMs: boundedDurationMs(startedAt),
        }),
      );
      return {
        outcome: "RECOVERY_ALREADY_IN_PROGRESS",
        sessionId,
        sessionKey,
        durationMs: boundedDurationMs(startedAt),
        message: "Authentication recovery is already in progress for this session.",
        mappedOaCount,
      };
    }

    // Trigger condition 3: Cooldown check
    if (!options.bypassCooldown) {
      const remaining = this.getCooldownRemainingMs(sessionId, cooldownMs);
      if (remaining > 0) {
        this.logger.log(
          JSON.stringify({
            event: "line_chat_auth_recovery_skipped",
            sessionId,
            sessionKey,
            outcome: "RECOVERY_SKIPPED_COOLDOWN",
            remainingMs: remaining,
            durationMs: boundedDurationMs(startedAt),
          }),
        );
        return {
          outcome: "RECOVERY_SKIPPED_COOLDOWN",
          sessionId,
          sessionKey,
          durationMs: boundedDurationMs(startedAt),
          message: `Recovery skipped due to active cooldown (${Math.ceil(remaining / 1000)}s remaining).`,
          mappedOaCount,
        };
      }
    }

    // Trigger condition 4: Active database profile leases count must be 0
    const activeLeaseCount = await this.prisma.lineChatProfileOperationLease.count({
      where: {
        lineChatSessionId: sessionId,
        leaseUntil: { gt: new Date() },
      },
    });

    if (activeLeaseCount > 0) {
      this.logger.log(
        JSON.stringify({
          event: "line_chat_auth_recovery_skipped",
          sessionId,
          sessionKey,
          outcome: "RECOVERY_SKIPPED_ACTIVE_LEASE",
          activeLeaseCount,
          durationMs: boundedDurationMs(startedAt),
        }),
      );
      return {
        outcome: "RECOVERY_SKIPPED_ACTIVE_LEASE",
        sessionId,
        sessionKey,
        durationMs: boundedDurationMs(startedAt),
        message: "Recovery skipped because an active profile operation lease is held.",
        mappedOaCount,
      };
    }

    // Profile path resolution - must be isolated to session's own profile
    let profilePath: string;
    try {
      profilePath = this.sessionService.resolveProfilePath(session);
    } catch {
      return {
        outcome: "RECOVERY_FAILED_SAFE",
        sessionId,
        sessionKey,
        durationMs: boundedDurationMs(startedAt),
        message: "Failed to resolve persistent profile path.",
        failureStage: "PROFILE_PATH_INVALID",
        mappedOaCount,
      };
    }

    if (!fs.existsSync(profilePath)) {
      return {
        outcome: "MANUAL_REAUTH_REQUIRED",
        sessionId,
        sessionKey,
        durationMs: boundedDurationMs(startedAt),
        message: "Persistent profile directory does not exist. Manual login required.",
        failureStage: "PROFILE_MISSING",
        mappedOaCount,
      };
    }

    this.inProgress.add(sessionId);
    this.lastAttemptAt.set(sessionId, Date.now());

    this.logger.log(
      JSON.stringify({
        event: "line_chat_auth_recovery_started",
        sessionId,
        sessionKey,
        source,
        mappedOaCount,
      }),
    );

    try {
      const coordinated = await this.profileCoordinator.withProfileOperation(
        { sessionId, operationKind: "HEALTH_SESSION" },
        async (context) => {
          context.assertOwnership();
          return this.executeRecoveryBrowserFlow({
            profilePath,
            customLauncher: options.customLauncher,
            botIds: session.lineOfficialAccounts
              .map((oa) => oa.chatBotId)
              .filter((id): id is string => Boolean(id)),
            assertOwnership: () => context.assertOwnership(),
          });
        },
      );

      if (!coordinated.acquired) {
        this.logger.log(
          JSON.stringify({
            event: "line_chat_auth_recovery_skipped",
            sessionId,
            sessionKey,
            outcome: "RECOVERY_SKIPPED_ACTIVE_LEASE",
            reason: coordinated.reason,
            durationMs: boundedDurationMs(startedAt),
          }),
        );
        return {
          outcome: "RECOVERY_SKIPPED_ACTIVE_LEASE",
          sessionId,
          sessionKey,
          durationMs: boundedDurationMs(startedAt),
          message: "Profile coordinator could not acquire lease for recovery.",
          mappedOaCount,
        };
      }

      const browserResult = coordinated.value;
      const durationMs = boundedDurationMs(startedAt);

      if (browserResult.outcome === "RECOVERED_REMEMBERED_ACCOUNT") {
        // Record transition to CONNECTED via canonical health service
        await this.healthService.recordSessionHealthResult({
          sessionId,
          status: "CONNECTED",
          failureStage: null,
          checkedAt: new Date(),
          httpStatus: 200,
          durationMs,
          source,
        });

        // Ensure session.status is ACTIVE and consecutive failures reset
        await this.prisma.lineChatSession.update({
          where: { id: sessionId },
          data: {
            status: LineChatSessionStatus.ACTIVE,
            healthConsecutiveFailures: 0,
          },
        });

        this.logger.log(
          JSON.stringify({
            event: "line_chat_auth_recovery_succeeded",
            sessionId,
            sessionKey,
            outcome: browserResult.outcome,
            durationMs,
            mappedOaCount,
          }),
        );

        return {
          outcome: "RECOVERED_REMEMBERED_ACCOUNT",
          sessionId,
          sessionKey,
          durationMs,
          message: "Successfully recovered session using remembered account credentials.",
          mappedOaCount,
        };
      }

      if (browserResult.outcome === "MANUAL_REAUTH_REQUIRED") {
        this.logger.warn(
          JSON.stringify({
            event: "line_chat_auth_recovery_manual_required",
            sessionId,
            sessionKey,
            outcome: "MANUAL_REAUTH_REQUIRED",
            reason: browserResult.reason,
            durationMs,
            mappedOaCount,
          }),
        );

        return {
          outcome: "MANUAL_REAUTH_REQUIRED",
          sessionId,
          sessionKey,
          durationMs,
          message: browserResult.message || "Manual operator re-authentication is required.",
          failureStage: "MANAGER_AUTH",
          mappedOaCount,
        };
      }

      this.logger.warn(
        JSON.stringify({
          event: "line_chat_auth_recovery_failed",
          sessionId,
          sessionKey,
          outcome: browserResult.outcome,
          reason: browserResult.reason,
          durationMs,
          mappedOaCount,
        }),
      );

      return {
        outcome: browserResult.outcome,
        sessionId,
        sessionKey,
        durationMs,
        message: browserResult.message || "Automatic recovery could not be completed safely.",
        failureStage: "MANAGER_AUTH",
        mappedOaCount,
      };
    } catch (error: unknown) {
      const durationMs = boundedDurationMs(startedAt);
      const isTimeout = error instanceof Error && /timeout/i.test(error.message);
      const outcome: LineChatAuthRecoveryOutcome = isTimeout ? "RECOVERY_TIMEOUT" : "RECOVERY_FAILED_SAFE";

      this.logger.error(
        JSON.stringify({
          event: "line_chat_auth_recovery_failed",
          sessionId,
          sessionKey,
          outcome,
          error: error instanceof Error ? error.message : "UNKNOWN_ERROR",
          durationMs,
          mappedOaCount,
        }),
      );

      return {
        outcome,
        sessionId,
        sessionKey,
        durationMs,
        message: isTimeout ? "Recovery operation timed out." : "Recovery operation encountered a safe failure.",
        failureStage: "MANAGER_AUTH",
        mappedOaCount,
      };
    } finally {
      this.inProgress.delete(sessionId);
    }
  }

  private async executeRecoveryBrowserFlow(input: {
    profilePath: string;
    customLauncher?: ContextLauncher;
    botIds: string[];
    assertOwnership: () => void;
  }): Promise<{
    outcome: LineChatAuthRecoveryOutcome;
    reason?: string;
    message?: string;
  }> {
    const launcher = input.customLauncher ?? this.sessionService.defaultLauncher;
    input.assertOwnership();

    const context: BrowserContext = await launcher(input.profilePath, {
      profilePath: input.profilePath,
      headless: true,
    });

    try {
      const page = context.pages()[0] || (await context.newPage());
      input.assertOwnership();

      // Step 1: Navigate to chat.line.biz
      try {
        await page.goto("https://chat.line.biz/", {
          waitUntil: "domcontentloaded",
          timeout: 20000,
        });
      } catch {
        // Navigation timeout or network failure
        return {
          outcome: "RECOVERY_TIMEOUT",
          reason: "NAVIGATION_TIMEOUT",
          message: "Timed out navigating to chat.line.biz.",
        };
      }

      await page.waitForTimeout(1000).catch(() => {});
      input.assertOwnership();

      // Step 2: Check if already authenticated on initial open (only if not redirected to login)
      const currentLandingUrl = page.url();
      const isLoginDestination = isLoginLikeNavigationUrl(currentLandingUrl);

      if (!isLoginDestination) {
        const alreadyAuthProbe = await this.sessionService.probeApiAuthentication(context);
        if (alreadyAuthProbe.authenticated === "YES") {
          const chatsVerified = await this.verifyMappedOaChats(context, input.botIds);
          if (chatsVerified) {
            this.logger.log(
              JSON.stringify({
                event: "line_chat_auth_recovery_already_authenticated",
              }),
            );
            return {
              outcome: "RECOVERED_REMEMBERED_ACCOUNT",
              message: "Session is already authenticated.",
            };
          }
        }
      }

      // Step 3: Check human-required boundaries on landing page
      const landingChallenge = await this.detectHumanChallenge(page);
      if (landingChallenge.challengeDetected) {
        return {
          outcome: "MANUAL_REAUTH_REQUIRED",
          reason: landingChallenge.reason,
          message: `Authentication challenge detected (${landingChallenge.reason}). Manual login required.`,
        };
      }

      // Step 4: Look for LINE account login option
      const lineAccountButton = await this.findLineAccountLoginOption(page);
      if (!lineAccountButton) {
        // No deterministic LINE account button found and not authenticated
        const currentUrl = page.url();
        const isLogin = isLoginLikeNavigationUrl(currentUrl);
        return {
          outcome: "MANUAL_REAUTH_REQUIRED",
          reason: isLogin ? "LINE_ACCOUNT_BUTTON_NOT_FOUND" : "UNKNOWN_LANDING_PAGE",
          message: "LINE account login option not found. Manual login required.",
        };
      }

      // Click "LINE account" option
      input.assertOwnership();
      await lineAccountButton.click({ timeout: 5000 }).catch(() => {});
      await page.waitForLoadState("domcontentloaded", { timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1500).catch(() => {});
      input.assertOwnership();

      // Step 5: Check human challenges after selecting LINE account
      const postClickChallenge = await this.detectHumanChallenge(page);
      if (postClickChallenge.challengeDetected) {
        return {
          outcome: "MANUAL_REAUTH_REQUIRED",
          reason: postClickChallenge.reason,
          message: `Authentication challenge detected (${postClickChallenge.reason}). Manual login required.`,
        };
      }

      // Step 6: Check for ambiguous multiple accounts
      const multiAccountsDetected = await this.detectMultipleAccounts(page);
      if (multiAccountsDetected) {
        return {
          outcome: "MANUAL_REAUTH_REQUIRED",
          reason: "AMBIGUOUS_MULTIPLE_ACCOUNTS",
          message: "Multiple remembered accounts detected. Manual account selection required.",
        };
      }

      // Step 7: Detect remembered account single "Log in" continuation button
      const loginButton = await this.findRememberedAccountLoginButton(page);
      if (!loginButton) {
        return {
          outcome: "MANUAL_REAUTH_REQUIRED",
          reason: "REMEMBERED_ACCOUNT_LOGIN_BUTTON_NOT_FOUND",
          message: "Remembered account login button not found. Manual login required.",
        };
      }

      this.logger.log(
        JSON.stringify({
          event: "line_chat_auth_recovery_remembered_account_detected",
        }),
      );

      // Step 8: Click the remembered account "Log in" button
      input.assertOwnership();
      await loginButton.click({ timeout: 5000 });

      // Wait for navigation / redirect
      try {
        await page.waitForNavigation({ timeout: 15000, waitUntil: "domcontentloaded" }).catch(() => {});
      } catch {
        // Continue even if navigation event already occurred
      }
      await page.waitForTimeout(2000).catch(() => {});
      input.assertOwnership();

      // Step 9: Verify success proof
      // 1. /api/v1/me returns 200
      const postAuthProbe = await this.sessionService.probeApiAuthentication(context);
      if (postAuthProbe.authenticated !== "YES") {
        return {
          outcome: "RECOVERY_FAILED_SAFE",
          reason: "API_ME_AUTH_FAILED",
          message: "Authentication probe /api/v1/me did not return HTTP 200.",
        };
      }

      // 2. Mapped OA chats endpoint returns 200
      const chatsVerified = await this.verifyMappedOaChats(context, input.botIds);
      if (!chatsVerified) {
        return {
          outcome: "RECOVERY_FAILED_SAFE",
          reason: "MAPPED_OA_CHATS_PROBE_FAILED",
          message: "Mapped OA chat list endpoint verification failed.",
        };
      }

      // 3. No active auth challenge remains
      const currentUrl = page.url();
      if (isLoginLikeNavigationUrl(currentUrl)) {
        return {
          outcome: "MANUAL_REAUTH_REQUIRED",
          reason: "POST_LOGIN_CHALLENGE_REMAINS",
          message: "Page remains on authentication destination after login.",
        };
      }

      return {
        outcome: "RECOVERED_REMEMBERED_ACCOUNT",
        message: "Successfully logged in via remembered LINE account.",
      };
    } finally {
      await context.close().catch(() => {});
    }
  }

  private async detectHumanChallenge(page: Page): Promise<{ challengeDetected: boolean; reason?: string }> {
    try {
      // 1. Password or credential inputs
      const hasCredentialInput = await page
        .locator(
          'input[type="password"], input[type="email"], input[name="tid"], input[name*="mail" i], input[name*="user" i]',
        )
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (hasCredentialInput) return { challengeDetected: true, reason: "CREDENTIAL_INPUT_PRESENT" };

      // 2. QR code
      const hasQr = await page
        .locator('canvas, [data-testid*="qr" i], img[src*="qr" i], .qr-code, [class*="qr" i]')
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (hasQr) return { challengeDetected: true, reason: "QR_CODE_PRESENT" };

      // 3. OTP / verification code
      const hasOtp = await page
        .locator(
          'input[autocomplete="one-time-code"], input[name*="code" i], input[placeholder*="code" i], input[placeholder*="OTP" i], [data-testid*="otp" i]',
        )
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (hasOtp) return { challengeDetected: true, reason: "OTP_OR_VERIFICATION_CODE_PRESENT" };

      // 4. CAPTCHA
      const hasCaptcha = await page
        .locator('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], [class*="captcha" i]')
        .first()
        .isVisible({ timeout: 500 })
        .catch(() => false);
      if (hasCaptcha) return { challengeDetected: true, reason: "CAPTCHA_PRESENT" };

      return { challengeDetected: false };
    } catch {
      return { challengeDetected: false };
    }
  }

  private async detectMultipleAccounts(page: Page): Promise<boolean> {
    try {
      const candidates = page.locator(
        '[data-testid*="account-item"], input[type="radio"][name*="account"], .account-list > li, .user-item, [class*="account-card"]',
      );
      const count = await candidates.count().catch(() => 0);
      return count > 1;
    } catch {
      return false;
    }
  }

  private async findLineAccountLoginOption(page: Page) {
    const selectors = [
      'button:has-text("LINE account")',
      'button:has-text("LINEアカウント")',
      'button:has-text("บัญชี LINE")',
      'a:has-text("LINE account")',
      'a:has-text("LINEアカウント")',
      'a:has-text("บัญชี LINE")',
      'a[href*="/login/line"]',
      'button.btn-line',
      'a.btn-line',
      'button[data-testid*="line" i]',
      'a[data-testid*="line" i]',
      'button:has-text("LINE")',
      'a:has-text("LINE")',
    ];

    for (const selector of selectors) {
      try {
        const locator = page.locator(selector).first();
        if (await locator.isVisible({ timeout: 300 }).catch(() => false)) {
          return locator;
        }
      } catch {
        // Check next selector
      }
    }
    return null;
  }

  private async findRememberedAccountLoginButton(page: Page) {
    // If any credential input is present, this is NOT remembered single-click login
    const hasCredentialInput = await page
      .locator(
        'input[type="password"], input[type="email"], input[name="tid"], input[name*="mail" i], input[name*="user" i]',
      )
      .first()
      .isVisible({ timeout: 300 })
      .catch(() => false);
    if (hasCredentialInput) return null;

    const selectors = [
      'button[type="submit"]:has-text("Log in")',
      'button[type="submit"]:has-text("ログイン")',
      'button[type="submit"]:has-text("เข้าสู่ระบบ")',
      'button:has-text("Log in")',
      'button:has-text("ログイン")',
      'button:has-text("เข้าสู่ระบบ")',
      'button[data-testid*="login" i]:has-text("Log in")',
      'button[data-testid*="login" i]:has-text("ログイン")',
      'button[data-testid*="login" i]:has-text("เข้าสู่ระบบ")',
    ];

    for (const selector of selectors) {
      try {
        const locator = page.locator(selector).first();
        if (await locator.isVisible({ timeout: 300 }).catch(() => false)) {
          return locator;
        }
      } catch {
        // Check next selector
      }
    }
    return null;
  }

  private async verifyMappedOaChats(context: BrowserContext, botIds: string[]): Promise<boolean> {
    if (!botIds.length) {
      // If no bot mapped, /api/v1/me was already verified
      return true;
    }

    const requestContext = context.request;
    if (!requestContext || typeof requestContext.get !== "function") return false;

    // Verify at least one mapped OA chat list returns 200
    for (const botId of botIds.slice(0, 3)) {
      try {
        const endpoint = `https://chat.line.biz/api/v2/bots/${encodeURIComponent(botId)}/chats?limit=1`;
        const response = await requestContext.get(endpoint, {
          headers: { Accept: "application/json, text/plain, */*" },
          timeout: 10000,
          maxRedirects: 0,
        });
        if (response.status() >= 200 && response.status() < 300) {
          return true;
        }
      } catch {
        // Try next botId if available
      }
    }

    return false;
  }
}
