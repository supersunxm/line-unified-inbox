import { matchesLineChatWorkerSecret } from "./line-chat-worker-auth";
import type { LineChatTargetProofService } from "./line-chat-target-proof.service";

export const LINE_CHAT_TARGET_PROOF_PATH = "/internal/line-chat/target-proof";

export interface LineChatTargetProofHttpResponse {
  statusCode: number;
  body: unknown;
}

export async function handleLineChatTargetProofRoute(input: {
  method: string | undefined;
  pathname: string;
  receivedSecret: string | string[] | undefined;
  expectedSecret: string;
  readBody: () => Promise<unknown>;
  service: Pick<LineChatTargetProofService, "prove">;
}): Promise<LineChatTargetProofHttpResponse | null> {
  if (input.method !== "POST" || input.pathname !== LINE_CHAT_TARGET_PROOF_PATH) return null;
  const expectedSecret = input.expectedSecret.trim();
  if (!expectedSecret || !matchesLineChatWorkerSecret(input.receivedSecret, expectedSecret)) {
    return { statusCode: 401, body: { success: false, error: "UNAUTHORIZED" } };
  }

  let body: unknown;
  try {
    body = await input.readBody();
  } catch (error) {
    const tooLarge = error instanceof Error && error.message === "REQUEST_TOO_LARGE";
    return {
      statusCode: tooLarge ? 413 : 400,
      body: { success: false, error: tooLarge ? "REQUEST_TOO_LARGE" : "INVALID_REQUEST" },
    };
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { statusCode: 400, body: { success: false, error: "INVALID_REQUEST" } };
  }

  try {
    const proof = await input.service.prove(body as Parameters<LineChatTargetProofService["prove"]>[0]);
    if (!proof) return { statusCode: 400, body: { success: false, error: "INVALID_REQUEST" } };
    return { statusCode: 200, body: { success: true, proof } };
  } catch {
    return { statusCode: 503, body: { success: false, error: "TARGET_PROOF_FAILED" } };
  }
}
