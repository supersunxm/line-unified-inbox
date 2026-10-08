import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify on raw bytes, before JSON parsing. LINE signs request bytes, not reserialized JSON. */
export function verifySunnLineSignature(rawBody: Buffer | undefined, signature: string | undefined, channelSecret: string | undefined): boolean {
  if (!rawBody?.length || !signature || !channelSecret?.trim()) return false;
  const expected = createHmac("sha256", channelSecret).update(rawBody).digest();
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(signature)) return false;
  const supplied = Buffer.from(signature, "base64");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export type SecretarySource = { type?: unknown; groupId?: unknown; userId?: unknown };
export type SecretaryMessage = { type?: unknown; text?: unknown; mention?: { mentionees?: unknown } };
export type SecretaryEvent = { type?: unknown; source?: SecretarySource; message?: SecretaryMessage; webhookEventId?: unknown };
export type SecretaryConfig = { groupIds: readonly string[]; userIds: readonly string[]; botUserId: string };

/**
 * Strict allowlist: both LINE group AND actual sender must match.
 * Mentions must identify the LINE bot, not simply contain arbitrary @ text.
 * This filter performs no network actions and never trusts the displayed nickname.
 */
export function authorizeSunnEvent(event: SecretaryEvent, config: SecretaryConfig): boolean {
  const { source, message } = event;
  if (event.type !== "message" || message?.type !== "text" || typeof message.text !== "string") return false;
  if (source?.type !== "group" || typeof source.groupId !== "string" || typeof source.userId !== "string") return false;
  if (!config.groupIds.includes(source.groupId) || !config.userIds.includes(source.userId)) return false;
  if (!/^U[0-9a-f]{32}$/iu.test(config.botUserId)) return false;
  const mentionees = message.mention?.mentionees;
  if (!Array.isArray(mentionees)) return false;
  return mentionees.some((entry: unknown) => {
    if (!entry || typeof entry !== "object") return false;
    const mention = entry as Record<string, unknown>;
    return mention.type === "user" && (mention.userId === config.botUserId || (mention.isSelf === true && typeof mention.userId !== "string"));
  });
}

/** The core accepts only nonempty opaque event IDs for later persistent replay protection. */
export function validateSunnEventId(event: SecretaryEvent): string | null {
  const id = event.webhookEventId;
  return typeof id === "string" && id.length > 0 && id.length <= 256 ? id : null;
}
