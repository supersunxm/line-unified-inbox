import { BadRequestException, HttpException, HttpStatus, Injectable } from "@nestjs/common";

export class LineMessagingApiError extends HttpException {
  readonly lineStatus: number;
  readonly lineRequestId: string | null;
  readonly lineErrorMessage: string | null;
  readonly retryable: boolean;

  constructor(options: {
    lineStatus: number;
    lineRequestId: string | null;
    lineErrorMessage: string | null;
    userMessage: string;
  }) {
    // 400, 401, 403 are non-retryable client/configuration errors
    const isClientError =
      options.lineStatus === 400 || options.lineStatus === 401 || options.lineStatus === 403;
    const httpStatus =
      options.lineStatus === 429
        ? HttpStatus.TOO_MANY_REQUESTS
        : isClientError
        ? HttpStatus.BAD_GATEWAY
        : HttpStatus.SERVICE_UNAVAILABLE;

    super(options.userMessage, httpStatus);
    this.name = "LineMessagingApiError";
    this.lineStatus = options.lineStatus;
    this.lineRequestId = options.lineRequestId;
    this.lineErrorMessage = options.lineErrorMessage;
    this.retryable = !isClientError;
  }
}

export type PushMessageResult = {
  requestId: string | null;
  acceptedRequestId: string | null;
  externalMessageId: string | null;
  duplicateAccepted: boolean;
};

export type MulticastMessageResult = {
  requestId: string | null;
  acceptedRequestId: string | null;
  duplicateAccepted: boolean;
};

export type LineImageInput = {
  accessToken: string;
  lineUserId: string;
  originalContentUrl: string;
  previewImageUrl: string;
  retryKey: string;
};

export type LineMulticastInput = {
  accessToken: string;
  to: string[];
  messages: unknown[];
  retryKey: string;
};

@Injectable()
export class LineMessagingService {
  async pushText(input: {
    accessToken: string;
    lineUserId: string;
    text: string;
    retryKey: string;
  }): Promise<PushMessageResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;

    try {
      response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
          "X-Line-Retry-Key": input.retryKey,
        },
        body: JSON.stringify({
          to: input.lineUserId,
          messages: [{ type: "text", text: input.text }],
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      throw new LineMessagingApiError({
        lineStatus: 0,
        lineRequestId: null,
        lineErrorMessage: err?.message || "Network error or timeout connecting to LINE API",
        userMessage: "ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง",
      });
    } finally {
      clearTimeout(timeout);
    }

    const duplicateAccepted =
      response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      throw await this.buildLineError(response);
    }

    let body: { sentMessages?: Array<{ id?: string }> } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      /* A successful LINE response may have no JSON body. */
    }
    return {
      requestId: response.headers.get("x-line-request-id"),
      acceptedRequestId: response.headers.get("x-line-accepted-request-id"),
      externalMessageId: body.sentMessages?.[0]?.id ?? null,
      duplicateAccepted,
    };
  }

  async pushImage(input: LineImageInput): Promise<PushMessageResult> {
    return this.pushMessages(
      input.accessToken,
      input.lineUserId,
      [
        {
          type: "image",
          originalContentUrl: input.originalContentUrl,
          previewImageUrl: input.previewImageUrl,
        },
      ],
      input.retryKey,
    );
  }

  async multicast(input: LineMulticastInput): Promise<MulticastMessageResult> {
    if (!input.to.length || input.to.length > 500) {
      throw new BadRequestException("Multicast recipients must be between 1 and 500 users");
    }
    if (!input.messages.length || input.messages.length > 5) {
      throw new BadRequestException("Multicast messages must be between 1 and 5 message objects");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;

    try {
      response = await fetch("https://api.line.me/v2/bot/message/multicast", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
          "X-Line-Retry-Key": input.retryKey,
        },
        body: JSON.stringify({
          to: input.to,
          messages: input.messages,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      throw new LineMessagingApiError({
        lineStatus: 0,
        lineRequestId: null,
        lineErrorMessage: err?.message || "Network error or timeout connecting to LINE API",
        userMessage: "ส่งข้อความมัลติคาสต์ไม่สำเร็จ กรุณาลองอีกครั้ง",
      });
    } finally {
      clearTimeout(timeout);
    }

    const duplicateAccepted =
      response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      throw await this.buildLineError(response);
    }

    return {
      requestId: response.headers.get("x-line-request-id"),
      acceptedRequestId: response.headers.get("x-line-accepted-request-id"),
      duplicateAccepted,
    };
  }

  private async pushMessages(
    accessToken: string,
    lineUserId: string,
    messages: unknown[],
    retryKey: string,
  ): Promise<PushMessageResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "X-Line-Retry-Key": retryKey,
        },
        body: JSON.stringify({ to: lineUserId, messages }),
        signal: controller.signal,
      });
    } catch (err: any) {
      throw new LineMessagingApiError({
        lineStatus: 0,
        lineRequestId: null,
        lineErrorMessage: err?.message || "Network error or timeout connecting to LINE API",
        userMessage: "ส่งรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง",
      });
    } finally {
      clearTimeout(timeout);
    }

    const duplicateAccepted =
      response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      throw await this.buildLineError(response);
    }

    let body: { sentMessages?: Array<{ id?: string }> } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      /* successful LINE responses may be empty */
    }
    return {
      requestId: response.headers.get("x-line-request-id"),
      acceptedRequestId: response.headers.get("x-line-accepted-request-id"),
      externalMessageId: body.sentMessages?.[0]?.id ?? null,
      duplicateAccepted,
    };
  }

  private async buildLineError(response: Response): Promise<LineMessagingApiError> {
    const lineRequestId = response.headers.get("x-line-request-id");
    let lineErrorMessage: string | null = null;
    try {
      const errJson = (await response.json()) as {
        message?: string;
        details?: Array<{ message?: string; property?: string }>;
      };
      if (errJson?.message) {
        lineErrorMessage = errJson.message;
        if (Array.isArray(errJson.details) && errJson.details.length > 0) {
          const detailsStr = errJson.details
            .map((d) => (d.property ? `${d.property}: ${d.message}` : d.message))
            .filter(Boolean)
            .join(", ");
          if (detailsStr) {
            lineErrorMessage += ` (${detailsStr})`;
          }
        }
      }
    } catch {
      /* ignore body parse failures */
    }

    let userMessage = "ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง";
    if (response.status === 401) {
      userMessage = "Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ";
    } else if (response.status === 429) {
      userMessage = "LINE จำกัดจำนวนการส่งชั่วคราว กรุณาลองอีกครั้ง";
    } else if (response.status === 400 || response.status === 403) {
      userMessage = `LINE ปฏิเสธการส่งข้อความ${lineErrorMessage ? `: ${lineErrorMessage}` : ""}`;
    }

    return new LineMessagingApiError({
      lineStatus: response.status,
      lineRequestId,
      lineErrorMessage,
      userMessage,
    });
  }
}

