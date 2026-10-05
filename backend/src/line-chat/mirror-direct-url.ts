/** Verify a cache-only worker reply against the exact authorized conversation. */
export type DirectUrlIdentity = { storeId: string | null; lineOfficialAccountId: string; lineChatUserId: string | null };
export function validateMirrorDirectUrl(value: unknown, conversationId: string, identity: DirectUrlIdentity): string | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (body.success !== true || !body.target || typeof body.target !== "object") return null;
  const target = body.target as Record<string, unknown>;
  if (!identity.storeId || !/^U[0-9a-f]{32}$/iu.test(identity.lineChatUserId ?? "")
    || target.conversationId !== conversationId || target.storeId !== identity.storeId
    || target.lineOfficialAccountId !== identity.lineOfficialAccountId || target.lineChatUserId !== identity.lineChatUserId
    || typeof target.botId !== "string" || !/^U[0-9a-f]{32}$/iu.test(target.botId)) return null;
  const expected = `https://chat.line.biz/${target.botId}/chat/${identity.lineChatUserId}`;
  return target.url === expected ? expected : null;
}
export async function fetchCachedMirrorDirectUrl(conversationId: string, identity: DirectUrlIdentity): Promise<string | null> {
  const workerUrl = process.env.LINE_CHAT_WORKER_INTERNAL_URL?.trim().replace(/\/+$/u, "");
  const secret = process.env.LINE_CHAT_WORKER_INTERNAL_SECRET?.trim();
  if (!workerUrl || !secret || !identity.lineChatUserId) return null;
  try {
    const response = await fetch(`${workerUrl}/internal/line-chat/mirror/direct-url?conversationId=${encodeURIComponent(conversationId)}`, {
      headers: { "X-Line-Chat-Internal-Secret": secret }, signal: AbortSignal.timeout(3_000), redirect: "error",
    });
    return response.ok ? validateMirrorDirectUrl(await response.json(), conversationId, identity) : null;
  } catch {
    return null;
  }
}
