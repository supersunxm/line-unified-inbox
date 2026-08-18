import {
  BadGatewayException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import type {
  LineCouponCloseResult,
  LineCouponCreateResult,
  LineCouponPayload,
} from "./coupon.types";

@Injectable()
export class CouponLineClientService {
  async createCoupon(accessToken: string, payload: LineCouponPayload): Promise<LineCouponCreateResult> {
    const response = await this.request("https://api.line.me/v2/bot/coupon", {
      method: "POST",
      accessToken,
      body: payload,
    });

    const body = (await response.json()) as { couponId?: string };
    if (!body.couponId) {
      throw new BadGatewayException("LINE did not return a coupon ID");
    }

    return {
      couponId: body.couponId,
      requestId: response.headers.get("x-line-request-id"),
    };
  }

  async discontinueCoupon(accessToken: string, couponId: string): Promise<LineCouponCloseResult> {
    const safeCouponId = encodeURIComponent(couponId);
    const response = await this.request(`https://api.line.me/v2/bot/coupon/${safeCouponId}/close`, {
      method: "PUT",
      accessToken,
    });
    return { requestId: response.headers.get("x-line-request-id") };
  }

  private async request(
    url: string,
    input: { method: "POST" | "PUT"; accessToken: string; body?: unknown },
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let response: Response;

    try {
      response = await fetch(url, {
        method: input.method,
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          "Content-Type": "application/json",
        },
        ...(input.body === undefined ? {} : { body: JSON.stringify(input.body) }),
        signal: controller.signal,
      });
    } catch {
      throw new ServiceUnavailableException("LINE Coupon API is temporarily unavailable");
    } finally {
      clearTimeout(timeout);
    }

    if (response.ok) return response;

    let message = "LINE rejected the coupon request";
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Keep a sanitized generic error. Never include headers or tokens.
    }

    if (response.status === 400) {
      throw new BadRequestException(message);
    }
    if (response.status === 401) {
      throw new BadGatewayException("Channel Access Token is invalid or expired");
    }
    if (response.status === 429) {
      throw new HttpException("LINE Coupon API rate limit reached", HttpStatus.TOO_MANY_REQUESTS);
    }
    throw new BadGatewayException(message);
  }
}
