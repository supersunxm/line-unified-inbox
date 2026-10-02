/** Accepted durable Manager identities. Callers must scope these to one OA/conversation. */
export function canonicalSourceIds(message: { externalMessageId?: string | null; rawPayload?: unknown }): string[] {
  const raw = message.rawPayload && typeof message.rawPayload === "object" && !Array.isArray(message.rawPayload)
    ? message.rawPayload as Record<string, unknown> : {};
  return [...new Set([message.externalMessageId, raw.providerMessageId, raw.managerMessageId]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().replace(/^line-chat-manager:/u, "")))];
}

export function isCompatibleHistoricalDuplicate(
  canonical: { externalMessageId?: string | null; rawPayload?: unknown; messageType: string; direction: string; sentAt: Date; text: string | null },
  historical: { sourceEventId: string; direction: string; sentAt: Date; text: string },
): boolean {
  return canonicalSourceIds(canonical).includes(historical.sourceEventId.replace(/^line-chat-manager:/u, ""))
    && canonical.messageType === "TEXT"
    && canonical.direction === historical.direction
    && canonical.text === historical.text
    && Math.abs(canonical.sentAt.getTime() - historical.sentAt.getTime()) <= 1_000;
}
