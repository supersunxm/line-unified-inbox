import type { ApiConversation } from "@/types/api";

type Message = ApiConversation["messages"][number];

export function isMessageTranslationEligible(
  message: Pick<Message, "direction" | "messageType" | "originalText">,
  userRole: "ADMIN" | "VIEWER",
): boolean {
  return userRole === "ADMIN"
    && message.direction === "INBOUND"
    && message.messageType === "TEXT"
    && message.originalText.trim().length > 0;
}
