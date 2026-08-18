import { AUTH_UNAUTHORIZED_EVENT } from "@/lib/auth-session";
import { API_BASE_URL } from "@/lib/runtime-config";
import type {
  CouponCampaignDetail,
  CouponCampaignList,
  CouponInput,
  CouponPreview,
} from "@/types/coupons";

class CouponApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function couponRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const isBrowser = typeof window !== "undefined";
  const requestUrl = isBrowser ? `/api-backend${path}` : `${API_BASE_URL}${path}`;
  let response: Response;

  try {
    response = await fetch(requestUrl, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new CouponApiError("Unable to reach the coupon service.", 0);
  }

  if (!response.ok) {
    let message = `Coupon API request failed (${response.status})`;
    try {
      const body = (await response.json()) as { message?: string | string[] };
      if (body.message) message = Array.isArray(body.message) ? body.message.join(", ") : body.message;
    } catch {
      // Keep the generic response message.
    }
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTH_UNAUTHORIZED_EVENT));
    }
    throw new CouponApiError(message, response.status);
  }

  return response.json() as Promise<T>;
}

export const couponApi = {
  preview: (input: CouponInput) =>
    couponRequest<CouponPreview>("/coupons/preview", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  create: (input: CouponInput) =>
    couponRequest<CouponCampaignDetail>("/coupons", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  list: (limit = 50, offset = 0) =>
    couponRequest<CouponCampaignList>(`/coupons?limit=${limit}&offset=${offset}`),
  detail: (id: string) =>
    couponRequest<CouponCampaignDetail>(`/coupons/${encodeURIComponent(id)}`),
  retryFailed: (id: string) =>
    couponRequest<CouponCampaignDetail>(`/coupons/${encodeURIComponent(id)}/retry-failed`, {
      method: "POST",
    }),
  discontinue: (id: string) =>
    couponRequest<CouponCampaignDetail>(`/coupons/${encodeURIComponent(id)}/discontinue`, {
      method: "POST",
    }),
};
