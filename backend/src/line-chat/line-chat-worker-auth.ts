import { timingSafeEqual } from "node:crypto";

export function matchesLineChatWorkerSecret(
  received: string | string[] | undefined,
  expected: string,
): boolean {
  const candidate = Array.isArray(received) ? received[0] ?? "" : received ?? "";
  const receivedBuffer = Buffer.from(candidate);
  const expectedBuffer = Buffer.from(expected);
  if (receivedBuffer.length !== expectedBuffer.length || expectedBuffer.length === 0) return false;
  return timingSafeEqual(receivedBuffer, expectedBuffer);
}
