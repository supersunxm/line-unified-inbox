import type { LineChatMirrorService } from "./line-chat-mirror.service";

export const PINKLAO_RESOLVER_STARTUP_ENV = "LINE_CHAT_PINKLAO_RESOLVER_ON_STARTUP";
export const PINKLAO_RESOLVER_STORE_CODE = "29113";

type ResolverService = Pick<LineChatMirrorService, "getStoreMirrorTargetInputs" | "resolveMirrorTarget">;
type ResolverLogger = {
  log: (message: string) => unknown;
  warn: (message: string) => unknown;
};

export interface PinklaoResolverStartupResult {
  ran: boolean;
  attempts: number;
  success: boolean;
  targetResolutionSource: "MANAGER_ACCOUNT_REDIRECT" | null;
  errorCode: string | null;
}

export function isPinklaoResolverStartupEnabled(value: string | undefined): boolean {
  return value === "true";
}

function sleep(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, milliseconds);
    timer.unref?.();
  });
}

export async function runPinklaoResolverStartupDiagnostic(input: {
  enabled: boolean;
  service: ResolverService;
  logger: ResolverLogger;
  maxAttempts?: number;
  retryDelayMs?: number;
}): Promise<PinklaoResolverStartupResult> {
  if (!input.enabled) {
    return {
      ran: false,
      attempts: 0,
      success: false,
      targetResolutionSource: null,
      errorCode: null,
    };
  }

  const maxAttempts = Math.max(1, Math.min(5, Math.floor(input.maxAttempts ?? 3)));
  const retryDelayMs = Math.max(0, Math.min(60_000, Math.floor(input.retryDelayMs ?? 10_000)));

  input.logger.log(JSON.stringify({
    event: "line_chat_pinklao_resolver_startup_started",
    storeCode: PINKLAO_RESOLVER_STORE_CODE,
    maxAttempts,
    retryDelayMs,
    mode: "READ_ONLY_FRESH_REDIRECT",
  }));

  try {
    const storeTarget = await input.service.getStoreMirrorTargetInputs(PINKLAO_RESOLVER_STORE_CODE);

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const target = await input.service.resolveMirrorTarget({
        storeCode: PINKLAO_RESOLVER_STORE_CODE,
        lineOfficialAccountId: storeTarget.oa.id,
        chatBotId: null,
        basicId: storeTarget.oa.basicId,
        lineChatWorkspaceUrl: storeTarget.oa.lineChatWorkspaceUrl,
        storeManagerUrl: storeTarget.storeManagerUrl,
        lineChatSession: null,
        bypassCache: true,
      });

      if (target.ok) {
        const freshRedirectProven = target.source === "MANAGER_ACCOUNT_REDIRECT";
        input.logger.log(JSON.stringify({
          event: "line_chat_pinklao_resolver_startup_completed",
          storeCode: PINKLAO_RESOLVER_STORE_CODE,
          attempt,
          success: freshRedirectProven,
          targetResolutionSource: target.source,
          freshRedirectProven,
          mode: "READ_ONLY_FRESH_REDIRECT",
        }));
        return {
          ran: true,
          attempts: attempt,
          success: freshRedirectProven,
          targetResolutionSource: freshRedirectProven ? "MANAGER_ACCOUNT_REDIRECT" : null,
          errorCode: freshRedirectProven ? null : "FRESH_REDIRECT_NOT_PROVEN",
        };
      }

      if (target.errorCode !== "MIRROR_MANAGER_TARGET_BUSY" || attempt === maxAttempts) {
        input.logger.log(JSON.stringify({
          event: "line_chat_pinklao_resolver_startup_completed",
          storeCode: PINKLAO_RESOLVER_STORE_CODE,
          attempt,
          success: false,
          targetResolutionSource: null,
          errorCode: target.errorCode,
          mode: "READ_ONLY_FRESH_REDIRECT",
        }));
        return {
          ran: true,
          attempts: attempt,
          success: false,
          targetResolutionSource: null,
          errorCode: target.errorCode,
        };
      }

      input.logger.log(JSON.stringify({
        event: "line_chat_pinklao_resolver_startup_retrying",
        storeCode: PINKLAO_RESOLVER_STORE_CODE,
        attempt,
        retryDelayMs,
        reason: "PROFILE_OPERATION_BUSY",
      }));
      await sleep(retryDelayMs);
    }

    return {
      ran: true,
      attempts: maxAttempts,
      success: false,
      targetResolutionSource: null,
      errorCode: "MIRROR_MANAGER_TARGET_BUSY",
    };
  } catch (error) {
    const errorType = error instanceof Error ? error.name.slice(0, 80) : "UNKNOWN_ERROR";
    input.logger.warn(JSON.stringify({
      event: "line_chat_pinklao_resolver_startup_failed",
      storeCode: PINKLAO_RESOLVER_STORE_CODE,
      errorType,
      mode: "READ_ONLY_FRESH_REDIRECT",
    }));
    return {
      ran: true,
      attempts: 1,
      success: false,
      targetResolutionSource: null,
      errorCode: errorType,
    };
  }
}
