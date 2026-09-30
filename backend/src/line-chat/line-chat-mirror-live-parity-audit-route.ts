import { matchesLineChatWorkerSecret } from "./line-chat-worker-auth";
import type { LineChatMirrorLiveParityAuditService } from "./line-chat-mirror-live-parity-audit.service";

export const LINE_CHAT_MIRROR_LIVE_PARITY_AUDIT_PATH = "/internal/line-chat/mirror/live-parity-audit";

export interface LineChatMirrorLiveParityAuditHttpResponse {
  statusCode: number;
  body: unknown;
}

export async function handleLineChatMirrorLiveParityAuditRoute(input: {
  method: string | undefined;
  pathname: string;
  watermarkValue: string | null;
  receivedSecret: string | string[] | undefined;
  expectedSecret: string;
  service: Pick<LineChatMirrorLiveParityAuditService, "getReport">;
  onError?: (error: unknown) => void;
}): Promise<LineChatMirrorLiveParityAuditHttpResponse | null> {
  if (input.method !== "GET" || input.pathname !== LINE_CHAT_MIRROR_LIVE_PARITY_AUDIT_PATH) return null;
  const expectedSecret = input.expectedSecret.trim();
  if (!expectedSecret || !matchesLineChatWorkerSecret(input.receivedSecret, expectedSecret)) {
    return { statusCode: 401, body: { success: false, error: "UNAUTHORIZED" } };
  }

  const value = input.watermarkValue?.trim() ?? "";
  const isoInstant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/u;
  const watermark = isoInstant.test(value) ? new Date(value) : new Date(Number.NaN);
  if (!Number.isFinite(watermark.getTime()) || watermark.getTime() > Date.now()) {
    return { statusCode: 400, body: { success: false, error: "INVALID_WATERMARK" } };
  }

  try {
    return {
      statusCode: 200,
      body: { success: true, report: await input.service.getReport(watermark) },
    };
  } catch (error) {
    input.onError?.(error);
    return { statusCode: 503, body: { success: false, error: "LIVE_PARITY_AUDIT_FAILED" } };
  }
}
