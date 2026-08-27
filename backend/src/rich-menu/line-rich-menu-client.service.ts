import {
  BadGatewayException,
  BadRequestException,
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
  }

  async createRichMenu(
    token: string,
    payload: LineRichMenuPayload,
  ): Promise<{ richMenuId: string }> {
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
  }

  async uploadRichMenuImage(
    token: string,
    richMenuId: string,
    imageBuffer: Buffer,
    contentType: string,
  ): Promise<void> {
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
  }

  async getDefaultRichMenu(
    token: string,
  ): Promise<{ richMenuId: string | null; source: "MESSAGING_API" | "OTHER_OR_MANAGER" | "NONE" }> {
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
  }

  async setDefaultRichMenu(token: string, richMenuId: string): Promise<void> {
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
  }

  async clearDefaultRichMenu(token: string): Promise<void> {
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
  }

  async deleteRichMenu(token: string, richMenuId: string): Promise<void> {
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
  }

  async getRichMenu(token: string, richMenuId: string): Promise<any> {
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
  }

  private async jsonRequest(
    url: string,
    input: { method: "GET" | "POST" | "DELETE"; token: string; body?: unknown },
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    try {
      return await fetch(url, {
        method: input.method,
        headers: {
          Authorization: `Bearer ${input.token}`,
          ...(input.body !== undefined ? { "Content-Type": "application/json" } : {}),
        },
        ...(input.body !== undefined ? { body: JSON.stringify(input.body) } : {}),
        signal: controller.signal,
      });
    } catch (err: any) {
      throw new BadGatewayException(`LINE request failed: ${err?.message || "network error"}`);
    } finally {
      clearTimeout(timeout);
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
