import type { ApiConversation } from "@/types/api";

type Message = ApiConversation["messages"][number];

export function isMessageTranslationEligible(
  message: Pick<Message, "direction" | "messageType" | "originalText">,
  userRole: "ADMIN" | "ASSISTANT" | "VIEWER",
): boolean {
  const supportedRole = userRole === "ADMIN" || userRole === "ASSISTANT" || userRole === "VIEWER";
  return supportedRole
    && message.direction === "INBOUND"
    && message.messageType === "TEXT"
    && message.originalText.trim().length > 0;
}
