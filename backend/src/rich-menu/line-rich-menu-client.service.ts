import {
  BadGatewayException,
  Injectable,
  Logger,
} from "@nestjs/common";
import { LineRichMenuPayload } from "./rich-menu.types";

export interface ILineRichMenuClient {
  validateRichMenu(token: string, payload: LineRichMenuPayload): Promise<{ valid: boolean; message?: string }>;
  createRichMenu(token: string, payload: LineRichMenuPayload): Promise<{ richMenuId: string }>;
  uploadRichMenuImage(token: string, richMenuId: string, imageBuffer: Buffer, contentType: string): Promise<void>;
  getDefaultRichMenu(token: string): Promise<{ richMenuId: string | null; source: "MESSAGING_API" | "OTHER_OR_MANAGER" | "NONE" }>;
  setDefaultRichMenu(token: string, richMenuId: string): Promise<void>;
  clearDefaultRichMenu(token: string): Promise<void>;
  deleteRichMenu(token: string, richMenuId: string): Promise<void>;
  getRichMenu(token: string, richMenuId: string): Promise<any>;
}

@Injectable()
export class LineRichMenuClientService implements ILineRichMenuClient {
  private readonly logger = new Logger(LineRichMenuClientService.name);

  async validateRichMenu(
    token: string,
    payload: LineRichMenuPayload,
  ): Promise<{ valid: boolean; message?: string }> {
    return this.executeWithRetry("validateRichMenu", async () => {
      const url = "https://api.line.me/v2/bot/richmenu/validate";
      const response = await this.jsonRequest(url, {
        method: "POST",
        token,
        body: payload,
      });

      if (response.status === 200) {
        return { valid: true };
      }

      let errorDetail = "Validation failed";
      try {
        const errorBody = (await response.json()) as { message?: string; details?: Array<{ message?: string }> };
        errorDetail = errorBody.details?.map((d) => d.message).filter(Boolean).join("; ") || errorBody.message || errorDetail;
      } catch {
        /* ignore json parse failure */
      }

      return { valid: false, message: errorDetail };
    });
  }

  async createRichMenu(
    token: string,
    payload: LineRichMenuPayload,
  ): Promise<{ richMenuId: string }> {
    return this.executeWithRetry("createRichMenu", async () => {
      const url = "https://api.line.me/v2/bot/richmenu";
      const response = await this.jsonRequest(url, {
        method: "POST",
        token,
        body: payload,
      });

      if (!response.ok) {
        const errText = await this.extractErrorMessage(response, "Failed to create rich menu on LINE");
        this.logger.error(`[LineRichMenuClient] createRichMenu failed (${response.status}): ${errText}`);
        throw new BadGatewayException(`LINE create rich menu failed: ${errText}`);
      }

      const body = (await response.json()) as { richMenuId?: string };
      if (!body.richMenuId) {
        throw new BadGatewayException("LINE did not return a richMenuId");
      }

      return { richMenuId: body.richMenuId };
    });
  }

  async uploadRichMenuImage(
    token: string,
    richMenuId: string,
    imageBuffer: Buffer,
    contentType: string,
  ): Promise<void> {
    return this.executeWithRetry("uploadRichMenuImage", async () => {
      const safeId = encodeURIComponent(richMenuId);
      const url = `https://api-data.line.me/v2/bot/richmenu/${safeId}/content`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20_000);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": contentType,
            "Content-Length": String(imageBuffer.length),
          },
          body: new Uint8Array(imageBuffer),
          signal: controller.signal,
        });

        if (response.status === 429 || (response.status >= 500 && response.status <= 504)) {
          const retryAfterHeader = response.headers.get("Retry-After");
          const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
          const errText = await this.extractErrorMessage(response, `LINE image upload returned HTTP ${response.status}`);
          const err = new BadGatewayException(`LINE image upload failed: ${errText}`);
          (err as any).status = response.status;
          (err as any).retryAfterSeconds = !isNaN(retryAfterSeconds!) ? retryAfterSeconds : undefined;
          throw err;
        }

        if (!response.ok) {
          const errText = await this.extractErrorMessage(response, "Failed to upload rich menu image to LINE");
          this.logger.error(`[LineRichMenuClient] uploadRichMenuImage failed (${response.status}): ${errText}`);
          throw new BadGatewayException(`LINE image upload failed: ${errText}`);
        }
      } catch (err: any) {
        if (err instanceof BadGatewayException) throw err;
        throw new BadGatewayException(`LINE image upload failed: ${err?.message || "network error"}`);
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  async getDefaultRichMenu(
    token: string,
  ): Promise<{ richMenuId: string | null; source: "MESSAGING_API" | "OTHER_OR_MANAGER" | "NONE" }> {
    return this.executeWithRetry("getDefaultRichMenu", async () => {
      const url = "https://api.line.me/v2/bot/user/all/richmenu";
      const response = await this.jsonRequest(url, {
        method: "GET",
        token,
      });

      if (response.status === 200) {
        const body = (await response.json()) as { richMenuId?: string };
        return {
          richMenuId: body.richMenuId || null,
          source: "MESSAGING_API",
        };
      }

      if (response.status === 404) {
        return {
          richMenuId: null,
          source: "NONE",
        };
      }

      if (response.status === 403) {
        return {
          richMenuId: null,
          source: "OTHER_OR_MANAGER",
        };
      }

      const errText = await this.extractErrorMessage(response, "Failed to get default rich menu");
      this.logger.warn(`[LineRichMenuClient] getDefaultRichMenu returned ${response.status}: ${errText}`);
      throw new BadGatewayException(`LINE get default rich menu failed (${response.status}): ${errText}`);
    });
  }

  async setDefaultRichMenu(token: string, richMenuId: string): Promise<void> {
    return this.executeWithRetry("setDefaultRichMenu", async () => {
      const safeId = encodeURIComponent(richMenuId);
      const url = `https://api.line.me/v2/bot/user/all/richmenu/${safeId}`;
      const response = await this.jsonRequest(url, {
        method: "POST",
        token,
      });

      if (!response.ok) {
        const errText = await this.extractErrorMessage(response, "Failed to set default rich menu on LINE");
        this.logger.error(`[LineRichMenuClient] setDefaultRichMenu failed (${response.status}): ${errText}`);
        throw new BadGatewayException(`LINE set default rich menu failed: ${errText}`);
      }
    });
  }

  async clearDefaultRichMenu(token: string): Promise<void> {
    return this.executeWithRetry("clearDefaultRichMenu", async () => {
      const url = "https://api.line.me/v2/bot/user/all/richmenu";
      const response = await this.jsonRequest(url, {
        method: "DELETE",
        token,
      });

      if (!response.ok && response.status !== 404) {
        const errText = await this.extractErrorMessage(response, "Failed to unlink default rich menu on LINE");
        this.logger.error(`[LineRichMenuClient] clearDefaultRichMenu failed (${response.status}): ${errText}`);
        throw new BadGatewayException(`LINE clear default rich menu failed: ${errText}`);
      }
    });
  }

  async deleteRichMenu(token: string, richMenuId: string): Promise<void> {
    return this.executeWithRetry("deleteRichMenu", async () => {
      const safeId = encodeURIComponent(richMenuId);
      const url = `https://api.line.me/v2/bot/richmenu/${safeId}`;
      const response = await this.jsonRequest(url, {
        method: "DELETE",
        token,
      });

      if (!response.ok && response.status !== 404) {
        const errText = await this.extractErrorMessage(response, "Failed to delete rich menu on LINE");
        this.logger.warn(`[LineRichMenuClient] deleteRichMenu failed (${response.status}): ${errText}`);
      }
    });
  }

  async getRichMenu(token: string, richMenuId: string): Promise<any> {
    return this.executeWithRetry("getRichMenu", async () => {
      const safeId = encodeURIComponent(richMenuId);
      const url = `https://api.line.me/v2/bot/richmenu/${safeId}`;
      const response = await this.jsonRequest(url, {
        method: "GET",
        token,
      });

      if (!response.ok) {
        const errText = await this.extractErrorMessage(response, "Failed to fetch rich menu from LINE");
        throw new BadGatewayException(`LINE get rich menu failed: ${errText}`);
      }

      return response.json();
    });
  }

  private async jsonRequest(
    url: string,
    input: { method: "GET" | "POST" | "DELETE"; token: string; body?: unknown },
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      const response = await fetch(url, {
        method: input.method,
        headers: {
          Authorization: `Bearer ${input.token}`,
          ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
        signal: controller.signal,
      });

      if (response.status === 429 || (response.status >= 500 && response.status <= 504)) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        const err = new BadGatewayException(`LINE API returned HTTP ${response.status}`);
        (err as any).status = response.status;
        (err as any).retryAfterSeconds = !isNaN(retryAfterSeconds!) ? retryAfterSeconds : undefined;
        throw err;
      }

      return response;
    } catch (err: any) {
      if (err instanceof BadGatewayException) throw err;
      throw new BadGatewayException(`LINE request failed: ${err?.message || "network error"}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private async executeWithRetry<T>(
    operationName: string,
    fn: () => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let attempt = 0;
    const backoffs = [2000, 5000, 10000, 30000];

    while (true) {
      try {
        return await fn();
      } catch (err: any) {
        attempt++;
        const isTransient =
          err?.status === 429 ||
          (typeof err?.status === "number" && err.status >= 500 && err.status <= 504) ||
          err?.code === "ECONNRESET" ||
          err?.code === "ETIMEDOUT" ||
          err?.name === "AbortError" ||
          (typeof err?.message === "string" && /timeout|network|econnreset|fetch failed/i.test(err.message));

        if (!isTransient || attempt > maxRetries) {
          throw err;
        }

        let waitMs = backoffs[Math.min(attempt - 1, backoffs.length - 1)];
        if (err?.retryAfterSeconds && err.retryAfterSeconds > 0) {
          waitMs = Math.min(err.retryAfterSeconds * 1000, 30000);
        }

        this.logger.warn(
          `[LineRichMenuClient] ${operationName} hit transient error (attempt ${attempt}/${maxRetries}), retrying in ${waitMs}ms: ${err?.message}`,
        );
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
  }

  private async extractErrorMessage(response: Response, fallback: string): Promise<string> {
    try {
      const json = (await response.json()) as { message?: string; details?: Array<{ message?: string }> };
      return json.details?.map((d) => d.message).filter(Boolean).join("; ") || json.message || fallback;
    } catch {
      return `${fallback} (HTTP ${response.status})`;
    }
  }
}
