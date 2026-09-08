import { Injectable, ServiceUnavailableException } from "@nestjs/common";

type WorkerRecoveryResponse = {
  success?: boolean;
  active?: boolean;
  sessionKey?: string;
  path?: string;
  expiresAt?: string;
  error?: string;
};

@Injectable()
export class LineChatNovncRecoveryService {
  public async status(sessionKey: string) {
    this.assertSession(sessionKey);
    const result = await this.callWorker("GET", "/internal/line-chat/recovery/status");
    return this.toPublicResult(result);
  }

  public async start(sessionKey: string) {
    this.assertSession(sessionKey);
    const result = await this.callWorker("POST", "/internal/line-chat/recovery/start", { sessionKey });
    return this.toPublicResult(result);
  }

  public async stop(sessionKey: string) {
    this.assertSession(sessionKey);
    const result = await this.callWorker("POST", "/internal/line-chat/recovery/stop", { sessionKey });
    return this.toPublicResult(result);
  }

  private assertSession(sessionKey: string): void {
    if (sessionKey !== "profile-b") throw new ServiceUnavailableException("Manual recovery is enabled only for profile-b.");
  }

  private async callWorker(method: "GET" | "POST", path: string, body?: unknown): Promise<WorkerRecoveryResponse> {
    const workerUrl = process.env.LINE_CHAT_WORKER_INTERNAL_URL?.trim().replace(/\/+$/u, "");
    const secret = process.env.LINE_CHAT_WORKER_INTERNAL_SECRET?.trim();
    if (!workerUrl || !secret) throw new ServiceUnavailableException("LINE Chat recovery worker is not configured.");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`${workerUrl}${path}`, {
        method,
        headers: {
          "X-Line-Chat-Internal-Secret": secret,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
      let payload: WorkerRecoveryResponse = {};
      try { payload = await response.json() as WorkerRecoveryResponse; } catch { /* fail below */ }
      if (!response.ok || payload.success !== true) {
        throw new ServiceUnavailableException(payload.error || "LINE Chat recovery worker rejected the request.");
      }
      return payload;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("LINE Chat recovery worker is unavailable.");
    } finally {
      clearTimeout(timeout);
    }
  }

  private toPublicResult(result: WorkerRecoveryResponse) {
    const baseUrl = process.env.LINE_CHAT_NOVNC_PUBLIC_BASE_URL?.trim().replace(/\/+$/u, "");
    const url = result.active && result.path && baseUrl ? `${baseUrl}${result.path}` : null;
    return {
      active: result.active === true,
      sessionKey: "profile-b",
      expiresAt: result.expiresAt ?? null,
      url,
      readyToOpen: Boolean(url),
    };
  }
}
