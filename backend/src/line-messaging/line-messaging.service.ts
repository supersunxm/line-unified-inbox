import { BadGatewayException, BadRequestException, HttpException, HttpStatus, Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { buildPdfFlexMessage } from "./line-pdf-message";

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
export type BroadcastMessageResult = MulticastMessageResult;
export type LineBroadcastInput = {
  accessToken: string;
  messages: unknown[];
  retryKey: string;
  notificationDisabled?: boolean;
};
export type LineNarrowcastInput = LineBroadcastInput & {
  demographic: Record<string, unknown>;
  limit?: {
    max?: number;
    upToRemainingQuota?: boolean;
    forbidPartialDelivery?: boolean;
  };
};
export type LineNarrowcastProgress = {
  phase: "waiting" | "sending" | "succeeded" | "failed";
  successCount?: number;
  failureCount?: number;
  targetCount?: number;
  failedDescription?: string;
  errorCode?: number;
  acceptedTime?: string;
  completedTime?: string;
};
export type LinePushDiagnosticContext = {
  conversationId?: string;
  userId?: string;
  storeId?: string;
  storeName?: string;
  channelId?: string;
  messageType?: string;
  imageUrlDomain?: string;
  fileUrlDomain?: string;
  replyTokenAgeMs?: number;
  replyTokenAgeBucket?: string;
  deliveryMethod?: "REPLY" | "PUSH";
  fallbackReason?: string;
};
export type LineImageInput = { accessToken: string; lineUserId: string; originalContentUrl: string; previewImageUrl: string; retryKey: string; context?: LinePushDiagnosticContext };
export type LineTextInput = { accessToken: string; lineUserId: string; text: string; retryKey: string; context?: LinePushDiagnosticContext };
export type LinePdfInput = { accessToken: string; lineUserId: string; filename: string; fileSize: number; url: string; retryKey: string; context?: LinePushDiagnosticContext };
export type LineMulticastInput = { accessToken: string; to: string[]; messages: unknown[]; retryKey: string; context?: LinePushDiagnosticContext };
export type LineReplyResult = {
  success: boolean;
  invalidReplyToken?: boolean;
  requestId: string | null;
  externalMessageId: string | null;
};

function maskIdentifier(val?: string | null): string {
  if (!val) return "none";
  if (val.length <= 8) return "***";
  return `${val.slice(0, 4)}...${val.slice(-4)}`;
}

type LineErrorBody = { message?: string; details?: Array<{ message?: string; property?: string }> };

function parseLineErrorBody(rawBody: string): LineErrorBody | null {
  try {
    const parsed: unknown = JSON.parse(rawBody);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as { message?: unknown; details?: unknown };
    const details = Array.isArray(record.details)
      ? record.details
          .filter((detail): detail is { message?: unknown; property?: unknown } => typeof detail === "object" && detail !== null)
          .map((detail) => ({
            message: typeof detail.message === "string" ? detail.message : undefined,
            property: typeof detail.property === "string" ? detail.property : undefined,
          }))
      : undefined;
    return {
      message: typeof record.message === "string" ? record.message : undefined,
      details,
    };
  } catch {
    return null;
  }
}

@Injectable()
export class LineMessagingService {
  async replyText(input: {
    accessToken: string;
    replyToken: string;
    text: string;
    context?: LinePushDiagnosticContext;
  }): Promise<LineReplyResult> {
    return this.replyMessages(input.accessToken, input.replyToken, [{ type: "text", text: input.text }], {
      ...input.context,
      messageType: "TEXT",
    });
  }

  async replyImage(input: {
    accessToken: string;
    replyToken: string;
    originalContentUrl: string;
    previewImageUrl: string;
    context?: LinePushDiagnosticContext;
  }): Promise<LineReplyResult> {
    let domain: string | undefined;
    try { domain = new URL(input.originalContentUrl).hostname; } catch { /* ignore */ }
    return this.replyMessages(input.accessToken, input.replyToken, [{ type: "image", originalContentUrl: input.originalContentUrl, previewImageUrl: input.previewImageUrl }], {
      ...input.context,
      messageType: "IMAGE",
      imageUrlDomain: domain,
    });
  }

  async replyPdfDocument(input: { accessToken: string; replyToken: string; filename: string; fileSize: number; url: string; context?: LinePushDiagnosticContext }): Promise<LineReplyResult> {
    return this.replyMessages(input.accessToken, input.replyToken, [buildPdfFlexMessage(input)], {
      ...input.context,
      messageType: "FILE",
      fileUrlDomain: new URL(input.url).hostname,
    });
  }

  async replyMessages(
    accessToken: string,
    replyToken: string,
    messages: unknown[],
    context?: LinePushDiagnosticContext,
  ): Promise<LineReplyResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;

    Logger.log(
      JSON.stringify({
        event: "line_reply_started",
        userId: context?.userId ?? null,
        storeId: context?.storeId ?? null,
        storeName: context?.storeName ?? null,
        channelIdMasked: maskIdentifier(context?.channelId),
        messageType: context?.messageType ?? "UNKNOWN",
        imageUrlDomain: context?.imageUrlDomain ?? null,
        fileUrlDomain: context?.fileUrlDomain ?? null,
      }),
      "LineMessagingService"
    );

    try {
      response = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ replyToken, messages }),
        signal: controller.signal,
      });
    } catch (error) {
      Logger.warn(
        JSON.stringify({
          event: "line_reply_network_error",
          userId: context?.userId ?? null,
          storeId: context?.storeId ?? null,
          error: error instanceof Error ? error.message : "unknown",
        }),
        "LineMessagingService"
      );
      throw new ServiceUnavailableException("ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      let rawBody = "";
      let errorJson: { message?: string; details?: Array<{ message?: string; property?: string }> } | null = null;
      try {
        rawBody = await response.text();
        errorJson = parseLineErrorBody(rawBody);
      } catch {
        /* ignore */
      }

      const requestId = response.headers.get("x-line-request-id");
      const msg = errorJson?.message?.toLowerCase() ?? "";
      const isInvalidReplyToken =
        response.status === 400 &&
        (msg.includes("invalid reply token") ||
          msg.includes("reply token has expired") ||
          msg.includes("already used") ||
          msg.includes("invalid token") ||
          msg.includes("replytoken"));

      Logger.warn(
        JSON.stringify({
          event: "line_reply_failed",
          userId: context?.userId ?? null,
          storeId: context?.storeId ?? null,
          storeName: context?.storeName ?? null,
          channelIdMasked: maskIdentifier(context?.channelId),
          messageType: context?.messageType ?? "UNKNOWN",
          statusCode: response.status,
          isInvalidReplyToken,
          errorBody: errorJson || rawBody || "empty",
          requestId,
        }),
        "LineMessagingService"
      );

      if (isInvalidReplyToken) {
        return {
          success: false,
          invalidReplyToken: true,
          requestId,
          externalMessageId: null,
        };
      }

      if (response.status === 401) {
        throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ");
      }
      if (response.status === 429) {
        throw new HttpException("LINE จำกัดจำนวนการส่งชั่วคราว กรุณาลองอีกครั้ง", HttpStatus.TOO_MANY_REQUESTS);
      }
      const detailsStr = errorJson?.details?.map((d) => `${d.property || "field"}: ${d.message || "invalid"}`).join(", ");
      const errDetail = errorJson?.message ? `: ${errorJson.message}${detailsStr ? ` (${detailsStr})` : ""}` : "";
      throw new BadGatewayException(`LINE ปฏิเสธการส่งข้อความ${errDetail}`);
    }

    Logger.log(
      JSON.stringify({
        event: "line_message_delivery",
        conversationId: context?.conversationId ?? null,
        storeId: context?.storeId ?? null,
        messageType: context?.messageType ?? "UNKNOWN",
        deliveryMethod: "REPLY",
        replyTokenAgeMs: context?.replyTokenAgeMs ?? null,
        replyTokenAgeBucket: context?.replyTokenAgeBucket ?? null,
        statusCode: response.status,
        requestId: response.headers.get("x-line-request-id"),
      }),
      "LineMessagingService"
    );

    let body: { sentMessages?: Array<{ id?: string }> } = {};
    try { body = (await response.json()) as typeof body; } catch { /* ignore */ }
    return {
      success: true,
      requestId: response.headers.get("x-line-request-id"),
      externalMessageId: body.sentMessages?.[0]?.id ?? null,
    };
  }

  async pushText(input: LineTextInput): Promise<PushMessageResult> {
    return this.pushMessages(input.accessToken, input.lineUserId, [{ type: "text", text: input.text }], input.retryKey, {
      ...input.context,
      messageType: "TEXT",
    });
  }

  async pushImage(input: LineImageInput): Promise<PushMessageResult> {
    let domain: string | undefined;
    try { domain = new URL(input.originalContentUrl).hostname; } catch { /* ignore */ }
    return this.pushMessages(input.accessToken, input.lineUserId, [{ type: "image", originalContentUrl: input.originalContentUrl, previewImageUrl: input.previewImageUrl }], input.retryKey, {
      ...input.context,
      messageType: "IMAGE",
      imageUrlDomain: domain,
    });
  }

  async pushPdfDocument(input: LinePdfInput): Promise<PushMessageResult> {
    return this.pushMessages(input.accessToken, input.lineUserId, [buildPdfFlexMessage(input)], input.retryKey, {
      ...input.context,
      messageType: "FILE",
      fileUrlDomain: new URL(input.url).hostname,
    });
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

    Logger.log(
      JSON.stringify({
        event: "line_multicast_started",
        userId: input.context?.userId ?? null,
        storeId: input.context?.storeId ?? null,
        storeName: input.context?.storeName ?? null,
        channelIdMasked: maskIdentifier(input.context?.channelId),
        recipientsCount: input.to.length,
      }),
      "LineMessagingService"
    );

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
    } catch (error) {
      Logger.warn(`[LineMessaging] Network failure during multicast: ${error instanceof Error ? error.message : "unknown"}`, "LineMessagingService");
      throw new ServiceUnavailableException("ส่งข้อความมัลติคาสต์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      clearTimeout(timeout);
    }

    const duplicateAccepted = response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      let rawBody = "";
      let errorJson: { message?: string; details?: Array<{ message?: string; property?: string }> } | null = null;
      try {
        rawBody = await response.text();
        errorJson = parseLineErrorBody(rawBody);
      } catch {
        /* ignore */
      }

      Logger.warn(
        JSON.stringify({
          event: "line_multicast_failed",
          userId: input.context?.userId ?? null,
          storeId: input.context?.storeId ?? null,
          storeName: input.context?.storeName ?? null,
          channelIdMasked: maskIdentifier(input.context?.channelId),
          statusCode: response.status,
          errorBody: errorJson || rawBody || "empty",
          requestId: response.headers.get("x-line-request-id"),
        }),
        "LineMessagingService"
      );

      if (response.status === 401) throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ");
      if (response.status === 429) {
        const msg = errorJson?.message?.toLowerCase() ?? "";
        if (msg.includes("monthly limit") || msg.includes("quota")) {
          throw new HttpException("โควต้าการส่งข้อความฟรีรายเดือนของ LINE OA ร้านนี้เต็มแล้ว กรุณาอัปเกรดแพ็กเกจใน LINE Official Account Manager", HttpStatus.TOO_MANY_REQUESTS);
        }
        throw new HttpException("LINE จำกัดจำนวนการส่งชั่วคราว กรุณาลองอีกครั้ง", HttpStatus.TOO_MANY_REQUESTS);
      }
      const detailsStr = errorJson?.details?.map((d) => `${d.property || "field"}: ${d.message || "invalid"}`).join(", ");
      const errDetail = errorJson?.message ? `: ${errorJson.message}${detailsStr ? ` (${detailsStr})` : ""}` : "";
      if (response.status === 400 || response.status === 403) {
        throw new BadGatewayException(`LINE ปฏิเสธการส่งข้อความ${errDetail}`);
      }
      throw new ServiceUnavailableException("ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง");
    }

    return {
      requestId: response.headers.get("x-line-request-id"),
      acceptedRequestId: response.headers.get("x-line-accepted-request-id"),
      duplicateAccepted,
    };
  }

  async broadcast(input: LineBroadcastInput): Promise<BroadcastMessageResult> {
    return this.sendOfficialAccountBroadcast("broadcast", input);
  }

  async narrowcast(input: LineNarrowcastInput): Promise<BroadcastMessageResult> {
    return this.sendOfficialAccountBroadcast("narrowcast", input);
  }

  async getNarrowcastProgress(input: {
    accessToken: string;
    requestId: string;
  }): Promise<LineNarrowcastProgress> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    try {
      const url = new URL("https://api.line.me/v2/bot/message/progress/narrowcast");
      url.searchParams.set("requestId", input.requestId);
      response = await fetch(url, {
        method: "GET",
        headers: { Authorization: "Bearer " + input.accessToken },
        signal: controller.signal,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        "ตรวจสอบสถานะ Narrowcast ไม่สำเร็จ: " +
          (error instanceof Error ? error.message : "network error"),
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      let rawBody = "";
      try { rawBody = await response.text(); } catch { /* ignore */ }
      if (response.status === 401) {
        throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ");
      }
      throw new BadGatewayException(
        "LINE ปฏิเสธการตรวจสอบสถานะ Narrowcast" + (rawBody ? ": " + rawBody : ""),
      );
    }
    return (await response.json()) as LineNarrowcastProgress;
  }

  private async sendOfficialAccountBroadcast(
    mode: "broadcast" | "narrowcast",
    input: LineBroadcastInput | LineNarrowcastInput,
  ): Promise<BroadcastMessageResult> {
    if (!input.messages.length || input.messages.length > 5) {
      throw new BadRequestException("Broadcast messages must be between 1 and 5 message objects");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;
    const body: Record<string, unknown> = {
      messages: input.messages,
      notificationDisabled: input.notificationDisabled ?? false,
    };

    if (mode === "narrowcast") {
      const narrow = input as LineNarrowcastInput;
      body.filter = { demographic: narrow.demographic };
      if (narrow.limit) body.limit = narrow.limit;
    }

    try {
      response = await fetch("https://api.line.me/v2/bot/message/" + mode, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + input.accessToken,
          "Content-Type": "application/json",
          "X-Line-Retry-Key": input.retryKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      Logger.warn(
        "[LineMessaging] Network failure during " + mode + ": " +
          (error instanceof Error ? error.message : "unknown"),
        "LineMessagingService",
      );
      throw new ServiceUnavailableException("ส่ง Broadcast ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      clearTimeout(timeout);
    }

    const duplicateAccepted =
      response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      let rawBody = "";
      let errorJson: LineErrorBody | null = null;
      try {
        rawBody = await response.text();
        errorJson = parseLineErrorBody(rawBody);
      } catch {
        /* ignore */
      }
      if (response.status === 401) {
        throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ");
      }
      if (response.status === 429) {
        throw new HttpException(
          "LINE จำกัดการส่งหรือโควต้ารายเดือนของร้านนี้ไม่เพียงพอ",
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      const detailsStr = errorJson?.details
        ?.map((detail) => (detail.property || "field") + ": " + (detail.message || "invalid"))
        .join(", ");
      const errDetail = errorJson?.message
        ? ": " + errorJson.message + (detailsStr ? " (" + detailsStr + ")" : "")
        : rawBody
          ? ": " + rawBody
          : "";
      if (response.status === 403) {
        throw new HttpException(
          "LINE ไม่อนุญาต Targeting สำหรับร้านนี้" + errDetail,
          HttpStatus.FORBIDDEN,
        );
      }
      throw new BadGatewayException("LINE ปฏิเสธการส่ง Broadcast" + errDetail);
    }

    return {
      requestId: response.headers.get("x-line-request-id"),
      acceptedRequestId: response.headers.get("x-line-accepted-request-id"),
      duplicateAccepted,
    };
  }

  private async pushMessages(accessToken: string, lineUserId: string, messages: unknown[], retryKey: string, context?: LinePushDiagnosticContext): Promise<PushMessageResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;

    Logger.log(
      JSON.stringify({
        event: "line_push_started",
        userId: context?.userId ?? null,
        storeId: context?.storeId ?? null,
        storeName: context?.storeName ?? null,
        channelIdMasked: maskIdentifier(context?.channelId),
        messageType: context?.messageType ?? "UNKNOWN",
        imageUrlDomain: context?.imageUrlDomain ?? null,
        fileUrlDomain: context?.fileUrlDomain ?? null,
      }),
      "LineMessagingService"
    );

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
    } catch (error) {
      Logger.warn(
        JSON.stringify({
          event: "line_push_network_error",
          userId: context?.userId ?? null,
          storeId: context?.storeId ?? null,
          storeName: context?.storeName ?? null,
          error: error instanceof Error ? error.message : "unknown",
        }),
        "LineMessagingService"
      );
      throw new ServiceUnavailableException("ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      clearTimeout(timeout);
    }
    const duplicateAccepted = response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      let rawBody = "";
      let errorJson: { message?: string; details?: Array<{ message?: string; property?: string }> } | null = null;
      try {
        rawBody = await response.text();
        errorJson = parseLineErrorBody(rawBody);
      } catch {
        /* ignore JSON parse error */
      }
      Logger.warn(
        JSON.stringify({
          event: "line_push_failed",
          userId: context?.userId ?? null,
          storeId: context?.storeId ?? null,
          storeName: context?.storeName ?? null,
          channelIdMasked: maskIdentifier(context?.channelId),
          messageType: context?.messageType ?? "UNKNOWN",
          imageUrlDomain: context?.imageUrlDomain ?? null,
          fileUrlDomain: context?.fileUrlDomain ?? null,
          statusCode: response.status,
          errorBody: errorJson || rawBody || "empty",
          requestId: response.headers.get("x-line-request-id"),
        }),
        "LineMessagingService"
      );
      if (response.status === 401) throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ");
      if (response.status === 429) {
        const msg = errorJson?.message?.toLowerCase() ?? "";
        if (msg.includes("monthly limit") || msg.includes("quota")) {
          throw new HttpException("โควต้าการส่งข้อความฟรีรายเดือนของ LINE OA ร้านนี้เต็มแล้ว กรุณาอัปเกรดแพ็กเกจใน LINE Official Account Manager", HttpStatus.TOO_MANY_REQUESTS);
        }
        throw new HttpException("LINE จำกัดจำนวนการส่งชั่วคราว (Rate limit) กรุณาลองอีกครั้ง", HttpStatus.TOO_MANY_REQUESTS);
      }
      const detailsStr = errorJson?.details?.map((d) => `${d.property || "field"}: ${d.message || "invalid"}`).join(", ");
      const errDetail = errorJson?.message ? `: ${errorJson.message}${detailsStr ? ` (${detailsStr})` : ""}` : "";
      if (response.status === 400 || response.status === 403) {
        throw new BadGatewayException(`LINE ปฏิเสธการส่งข้อความ${errDetail}`);
      }
      throw new BadGatewayException(`LINE ปฏิเสธการส่งรูปภาพ${errDetail}`);
    }

    Logger.log(
      JSON.stringify({
        event: "line_message_delivery",
        conversationId: context?.conversationId ?? null,
        storeId: context?.storeId ?? null,
        messageType: context?.messageType ?? "UNKNOWN",
        deliveryMethod: "PUSH",
        fallbackReason: context?.fallbackReason ?? null,
        replyTokenAgeMs: context?.replyTokenAgeMs ?? null,
        replyTokenAgeBucket: context?.replyTokenAgeBucket ?? null,
        statusCode: response.status,
        requestId: response.headers.get("x-line-request-id"),
      }),
      "LineMessagingService"
    );

    let body: { sentMessages?: Array<{ id?: string }> } = {};
    try { body = (await response.json()) as typeof body; } catch { /* successful LINE responses may be empty */ }
    return {
      requestId: response.headers.get("x-line-request-id"),
      acceptedRequestId: response.headers.get("x-line-accepted-request-id"),
      externalMessageId: body.sentMessages?.[0]?.id ?? null,
      duplicateAccepted,
    };
  }
}
