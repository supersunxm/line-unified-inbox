import { createHash } from "node:crypto";
import { parseSunnSecretaryIntent, type SecretaryIntent } from "./sunn-secretary-intent";
import { authorizeSunnEvent, validateSunnEventId } from "./sunn-secretary-webhook-security";

export type InboundClassification = "AUTHORIZED" | "UNAUTHORIZED" | "UNSUPPORTED" | "MALFORMED";
export type InboundPlan = {
  version: 1;
  classification: InboundClassification;
  senderHash?: string;
  intent?: SecretaryIntent;
  attempts: number;
  lease?: string;
};
export const SUNN_INBOUND_PREFIX = "SUNN_SECRETARY_INBOUND_";
export type InboundState = "RECEIVED" | "PROCESSING" | "PREPARED" | "UNAUTHORIZED" | "UNSUPPORTED" | "MALFORMED" | "BLOCKED_SCOPE" | "FAILED_RETRYABLE" | "FAILED_FINAL";
export const senderHash = (id: string): string => createHash("sha256").update(`sunn-sender:v1:${id}`).digest("hex");
export const configuredSunnUsers = (): string[] => (process.env.SUNN_SECRETARY_ALLOWED_USER_IDS ?? "").split(",").map(id => id.trim()).filter(id => /^U[0-9a-f]{32}$/iu.test(id));
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);

/** No message text, reply token, group ID or customer information enters the durable plan. */
export function classifySunnInbound(input: unknown, botUserId: string, users: readonly string[], now: Date): { eventId: string | null; plan: InboundPlan } {
  const plan: InboundPlan = { version: 1, classification: "MALFORMED", attempts: 0 };
  if (!object(input)) return { eventId: null, plan };
  const eventId = validateSunnEventId(input);
  if (!eventId || [...eventId].some(char => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) || typeof input.type !== "string" ||
      !Number.isSafeInteger(input.timestamp) || (input.timestamp as number) < 0 || !object(input.source)) return { eventId, plan };
  if (input.type !== "message") return { eventId, plan: { ...plan, classification: "UNSUPPORTED" } };
  if (!object(input.message) || typeof input.message.type !== "string") return { eventId, plan };
  if (input.message.type !== "text") return { eventId, plan: { ...plan, classification: "UNSUPPORTED" } };
  if (typeof input.message.text !== "string" || input.message.text.length === 0 || input.message.text.length > 5000) return { eventId, plan };
  const source = input.source;
  if (source.type === "group" && (typeof source.groupId !== "string" || !/^C[0-9a-f]{32}$/iu.test(source.groupId) ||
      typeof source.userId !== "string" || !/^U[0-9a-f]{32}$/iu.test(source.userId))) return { eventId, plan };
  // Reject malformed nested metadata before calling the shared authorization policy.
  if (input.message.mention !== undefined && (!object(input.message.mention) || !Array.isArray(input.message.mention.mentionees) || input.message.mention.mentionees.length > 20)) return { eventId, plan };
  if (!authorizeSunnEvent(input, { userIds: users, botUserId })) return { eventId, plan: { ...plan, classification: "UNAUTHORIZED" } };
  const intent = parseSunnSecretaryIntent(input.message.text, now);
  return { eventId, plan: { ...plan, classification: intent.kind === "UNSUPPORTED" ? "UNSUPPORTED" : "AUTHORIZED", senderHash: senderHash(source.userId as string), intent } };
}

export function parseInboundPlan(value: string | null): InboundPlan {
  if (!value || value.length > 2048) throw new Error("INVALID_PLAN");
  const plan: unknown = JSON.parse(value);
  if (!object(plan) || plan.version !== 1 || !["AUTHORIZED", "UNAUTHORIZED", "UNSUPPORTED", "MALFORMED"].includes(String(plan.classification)) ||
      !Number.isSafeInteger(plan.attempts) || (plan.attempts as number) < 0 || (plan.attempts as number) > 3 ||
      (plan.lease !== undefined && (typeof plan.lease !== "string" || !/^[0-9a-f-]{36}$/u.test(plan.lease)))) throw new Error("INVALID_PLAN");
  if (plan.classification === "AUTHORIZED" && (typeof plan.senderHash !== "string" || !/^[0-9a-f]{64}$/u.test(plan.senderHash) ||
      !object(plan.intent) || plan.intent.kind !== "UNANSWERED_BY_STORE" || typeof plan.intent.month !== "string" || !/^20\d{2}-(0[1-9]|1[0-2])$/u.test(plan.intent.month))) throw new Error("INVALID_PLAN");
  return plan as InboundPlan;
}

/** Preparation boundary only. Execution must use an explicitly scoped read-only adapter in a later phase. */
export function prepareSunnReadOnlyCommand(plan: InboundPlan, users: readonly string[], scopes: unknown): InboundState {
  const user = users.find(id => senderHash(id) === plan.senderHash);
  if (!user) return "UNAUTHORIZED"; // Revocation takes effect before preparation and on recovery.
  if (!object(scopes) || !Array.isArray(scopes[user]) || scopes[user].length === 0 || scopes[user].length > 200 ||
      !scopes[user].every((id: unknown) => typeof id === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/iu.test(id))) return "BLOCKED_SCOPE";
  return "PREPARED";
}
