import { matchesLineChatWorkerSecret } from "./line-chat-worker-auth";
import type { NicknameSourceMappingService } from "./nickname-source-mapping.service";

export async function handleNicknameSourceAudit(input: {
  method: string | undefined; pathname: string; since: string | null;
  receivedSecret: string | string[] | undefined; expectedSecret: string;
  service: Pick<NicknameSourceMappingService, "audit">;
}): Promise<{ statusCode: number; body: unknown } | null> {
  if (input.pathname !== "/internal/line-chat/nickname-source/audit") return null;
  if (!input.expectedSecret || !matchesLineChatWorkerSecret(input.receivedSecret, input.expectedSecret)) return { statusCode: 401, body: { error: "UNAUTHORIZED" } };
  if (input.method !== "GET") return { statusCode: 405, body: { error: "READ_ONLY_ENDPOINT" } };
  const since = /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/u.test(input.since ?? "") ? new Date(input.since!) : new Date(Number.NaN);
  if (!Number.isFinite(since.getTime()) || since > new Date()) return { statusCode: 400, body: { error: "INVALID_WATERMARK" } };
  try { return { statusCode: 200, body: { success: true, ...(await input.service.audit(since)).report } }; }
  catch { return { statusCode: 503, body: { error: "AUDIT_FAILED" } }; }
}
