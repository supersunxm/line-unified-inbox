import {
  BmReplyStatus,
  Prisma,
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


export function effectiveReplyStateWhere(
  state: EffectiveReplyState,
): Prisma.ConversationWhereInput {
  if (state === "REPLIED") {
    return {
      OR: [
        { replyStateProjection: { is: { state: ReplyStateProjectionState.REPLIED } } },
        {
          AND: [
            { replyStateProjection: { is: null } },
            { bmReplyStatus: BmReplyStatus.REPLIED },
          ],
        },
      ],
    };
  }

  return {
    OR: [
      { replyStateProjection: { is: { state: ReplyStateProjectionState.NOT_REPLIED } } },
      {
        AND: [
          { replyStateProjection: { is: null } },
          { bmReplyStatus: { in: [BmReplyStatus.NOT_REPLIED, BmReplyStatus.NOTIFIED_BM] } },
        ],
      },
    ],
  };
}
