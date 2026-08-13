import { BadGatewayException, BadRequestException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from "@nestjs/common";

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
export type LineImageInput = { accessToken: string; lineUserId: string; originalContentUrl: string; previewImageUrl: string; retryKey: string };
export type LineMulticastInput = { accessToken: string; to: string[]; messages: unknown[]; retryKey: string };

@Injectable()
export class LineMessagingService {
  async pushText(input: { accessToken: string; lineUserId: string; text: string; retryKey: string }): Promise<PushMessageResult> {
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
    } catch {
      throw new ServiceUnavailableException("ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      clearTimeout(timeout);
    }

    const duplicateAccepted = response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      if (response.status === 401) throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ");
      if (response.status === 429) throw new HttpException("LINE จำกัดจำนวนการส่งชั่วคราว กรุณาลองอีกครั้ง", HttpStatus.TOO_MANY_REQUESTS);
      if (response.status === 400 || response.status === 403) throw new BadGatewayException("LINE ปฏิเสธการส่งข้อความ");
      throw new ServiceUnavailableException("ส่งข้อความไม่สำเร็จ กรุณาลองอีกครั้ง");
    }

    let body: { sentMessages?: Array<{ id?: string }> } = {};
    try { body = await response.json() as typeof body; } catch { /* A successful LINE response may have no JSON body. */ }
    return {
      requestId: response.headers.get("x-line-request-id"),
      acceptedRequestId: response.headers.get("x-line-accepted-request-id"),
      externalMessageId: body.sentMessages?.[0]?.id ?? null,
      duplicateAccepted,
    };
  }

  async pushImage(input: LineImageInput): Promise<PushMessageResult> {
    return this.pushMessages(input.accessToken, input.lineUserId, [{ type: "image", originalContentUrl: input.originalContentUrl, previewImageUrl: input.previewImageUrl }], input.retryKey);
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
    } catch {
      throw new ServiceUnavailableException("ส่งข้อความมัลติคาสต์ไม่สำเร็จ กรุณาลองอีกครั้ง");
    } finally {
      clearTimeout(timeout);
    }

    const duplicateAccepted = response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) {
      if (response.status === 401) throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ");
      if (response.status === 429) throw new HttpException("LINE จำกัดจำนวนการส่งชั่วคราว กรุณาลองอีกครั้ง", HttpStatus.TOO_MANY_REQUESTS);
      if (response.status === 400 || response.status === 403) {
        let errDetail = "";
        try {
          const errJson = (await response.json()) as { message?: string };
          if (errJson.message) errDetail = `: ${errJson.message}`;
        } catch {
          /* ignore */
        }
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

  private async pushMessages(accessToken: string, lineUserId: string, messages: unknown[], retryKey: string): Promise<PushMessageResult> {
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try { response = await fetch("https://api.line.me/v2/bot/message/push", { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", "X-Line-Retry-Key": retryKey }, body: JSON.stringify({ to: lineUserId, messages }), signal: controller.signal }); }
    catch { throw new ServiceUnavailableException("ส่งรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง"); }
    finally { clearTimeout(timeout); }
    const duplicateAccepted = response.status === 409 && Boolean(response.headers.get("x-line-accepted-request-id"));
    if (!response.ok && !duplicateAccepted) { if (response.status === 401) throw new BadGatewayException("Channel Access Token ของร้านนี้ไม่ถูกต้องหรือหมดอายุ"); if (response.status === 429) throw new HttpException("LINE จำกัดจำนวนการส่งชั่วคราว กรุณาลองอีกครั้ง", HttpStatus.TOO_MANY_REQUESTS); throw new BadGatewayException("LINE ปฏิเสธการส่งข้อความ"); }
    let body: { sentMessages?: Array<{ id?: string }> } = {}; try { body = await response.json() as typeof body; } catch { /* successful LINE responses may be empty */ }
    return { requestId: response.headers.get("x-line-request-id"), acceptedRequestId: response.headers.get("x-line-accepted-request-id"), externalMessageId: body.sentMessages?.[0]?.id ?? null, duplicateAccepted };
  }
}
