import {
  BmReplyStatus,
  ReplyStateProjectionState,
} from "@prisma/client";

export type EffectiveReplyState = "REPLIED" | "NOT_REPLIED";
export type EffectiveReplyStateSource = "PROJECTION" | "LEGACY_FALLBACK";

export type EffectiveReplyStateResult = {
  state: EffectiveReplyState;
  source: EffectiveReplyStateSource;
};

export function resolveEffectiveReplyState(input: {
  bmReplyStatus: BmReplyStatus | "REPLIED" | "NOT_REPLIED" | "NOTIFIED_BM";
  projectionState?: ReplyStateProjectionState | "REPLIED" | "NOT_REPLIED" | null;
}): EffectiveReplyStateResult {
  if (input.projectionState === "REPLIED" || input.projectionState === "NOT_REPLIED") {
    return {
      state: input.projectionState,
      source: "PROJECTION",
    };
  }

  return {
    state: input.bmReplyStatus === BmReplyStatus.REPLIED ? "REPLIED" : "NOT_REPLIED",
    source: "LEGACY_FALLBACK",
  };
}
