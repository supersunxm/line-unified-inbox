import { matchesLineChatWorkerSecret } from "./line-chat-worker-auth";
import type { LineChatMirrorService } from "./line-chat-mirror.service";

export async function handleMirrorDirectUrlRoute(input: {
  pathname: string; method: string | undefined; conversationId: string | null;
  receivedSecret: string | string[] | undefined; expectedSecret: string;
  service: Pick<LineChatMirrorService, "getCachedConversationDirectUrl">;
}): Promise<{ statusCode: number; body: unknown } | null> {
  if (input.pathname !== "/internal/line-chat/mirror/direct-url") return null;
  if (!input.expectedSecret.trim() || !matchesLineChatWorkerSecret(input.receivedSecret, input.expectedSecret.trim())) {
    return { statusCode: 401, body: { success: false, error: "UNAUTHORIZED" } };
  }
  if (input.method !== "GET") return { statusCode: 405, body: { success: false, error: "METHOD_NOT_ALLOWED" } };
  if (!input.conversationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(input.conversationId)) {
    return { statusCode: 400, body: { success: false, error: "INVALID_CONVERSATION_ID" } };
  }
  return { statusCode: 200, body: { success: true, target: await input.service.getCachedConversationDirectUrl(input.conversationId) } };
}
