import { BadGatewayException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from "@nestjs/common";

type PushMessageResult = {
  requestId: string | null;
  acceptedRequestId: string | null;
  externalMessageId: string | null;
  duplicateAccepted: boolean;
};

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
}
