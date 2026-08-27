import type { ApiConversation } from "@/types/api";

type ConversationMessage = ApiConversation["messages"][number];

/**
 * Return the persisted author name for outbound staff messages only.
 * Inbound customer messages and unattributed/system rows intentionally return
 * null; the UI must never infer an author from the logged-in operator.
 */
export function getMessageSenderName(message: Pick<ConversationMessage, "direction" | "sender">): string | null {
  if (message.direction !== "OUTBOUND") return null;
  const name = message.sender?.displayName?.trim();
  return name || null;
}
