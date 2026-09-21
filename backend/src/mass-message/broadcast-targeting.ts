import { BadRequestException } from "@nestjs/common";

export type FriendshipPeriodKey =
  | "LE_6"
  | "D7_29"
  | "D30_89"
  | "D90_179"
  | "D180_364"
  | "D365_PLUS";

export type BroadcastTargetingInput =
  | { mode: "ALL_FRIENDS" }
  | { mode: "FRIENDSHIP_PERIOD"; periods: FriendshipPeriodKey[] };

export type BroadcastAdvancedInput = {
  allowPartial?: boolean;
  maxVolume?: number | null;
};

export type BroadcastScheduleInput =
  | { mode: "NOW" }
  | { mode: "SCHEDULED"; scheduledAt: string };

export type BroadcastMessage =
  | { type: "text"; text: string }
  | {
      type: "image";
      originalContentUrl: string;
      previewImageUrl: string;
      originalObjectKey?: string;
      previewObjectKey?: string;
    }
  | {
      type: "rich_message";
      richMessageId: string;
    };

const ORDER: FriendshipPeriodKey[] = [
  "LE_6",
  "D7_29",
  "D30_89",
  "D90_179",
  "D180_364",
  "D365_PLUS",
];

const LOWER_BOUND: Array<string | undefined> = [
  undefined,
  "day_7",
  "day_30",
  "day_90",
  "day_180",
  "day_365",
];

const UPPER_BOUND: Array<string | undefined> = [
  "day_7",
  "day_30",
  "day_90",
  "day_180",
  "day_365",
  undefined,
];

export function validateBroadcastTargeting(input: BroadcastTargetingInput | undefined): BroadcastTargetingInput {
  if (!input || input.mode === "ALL_FRIENDS") return { mode: "ALL_FRIENDS" };
  if (input.mode !== "FRIENDSHIP_PERIOD") {
    throw new BadRequestException("Unsupported broadcast targeting mode");
  }
  const periods = [...new Set(input.periods ?? [])].filter((period): period is FriendshipPeriodKey =>
    ORDER.includes(period as FriendshipPeriodKey),
  );
  if (periods.length === 0) {
    throw new BadRequestException("Select at least one friendship period");
  }
  return { mode: "FRIENDSHIP_PERIOD", periods };
}

type SubscriptionPeriodFilter = {
  type: "subscriptionPeriod";
  gte?: string;
  lt?: string;
};

type DemographicFilter =
  | SubscriptionPeriodFilter
  | { type: "operator"; or: SubscriptionPeriodFilter[] };

function filterForRun(start: number, end: number): SubscriptionPeriodFilter[] {
  // LINE requires at least gte or lt. A run spanning every bucket needs two
  // complementary ranges so users with an unknown duration are not silently added.
  if (start === 0 && end === ORDER.length - 1) {
    return [
      { type: "subscriptionPeriod", lt: "day_365" },
      { type: "subscriptionPeriod", gte: "day_365" },
    ];
  }

  const filter: SubscriptionPeriodFilter = { type: "subscriptionPeriod" };
  const gte = LOWER_BOUND[start];
  const lt = UPPER_BOUND[end];
  if (gte) filter.gte = gte;
  if (lt) filter.lt = lt;
  return [filter];
}

export function buildFriendshipDemographicFilter(periods: FriendshipPeriodKey[]): DemographicFilter {
  const normalized = validateBroadcastTargeting({ mode: "FRIENDSHIP_PERIOD", periods });
  if (normalized.mode !== "FRIENDSHIP_PERIOD") {
    throw new BadRequestException("Friendship period targeting is required");
  }

  const indices = normalized.periods
    .map((period) => ORDER.indexOf(period))
    .sort((a, b) => a - b);

  const runs: Array<{ start: number; end: number }> = [];
  for (const index of indices) {
    const last = runs[runs.length - 1];
    if (!last || index > last.end + 1) {
      runs.push({ start: index, end: index });
    } else {
      last.end = index;
    }
  }

  const filters = runs.flatMap((run) => filterForRun(run.start, run.end));
  if (filters.length === 1) return filters[0];
  return { type: "operator", or: filters };
}

export function validateBroadcastMessages(messages: unknown[]): BroadcastMessage[] {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new BadRequestException("messages must contain at least one message object");
  }
  if (messages.length > 5) {
    throw new BadRequestException("Broadcast allows at most 5 message objects");
  }

  return messages.map((raw) => {
    if (!raw || typeof raw !== "object") {
      throw new BadRequestException("Invalid broadcast message object");
    }
    const item = raw as Record<string, unknown>;
    if (item.type === "text") {
      const text = typeof item.text === "string" ? item.text.trim() : "";
      if (!text) throw new BadRequestException("Text message content cannot be empty");
      if (text.length > 5000) throw new BadRequestException("Text message exceeds 5,000 character limit");
      return { type: "text", text };
    }
    if (item.type === "image") {
      const originalContentUrl =
        typeof item.originalContentUrl === "string" ? item.originalContentUrl.trim() : "";
      const previewImageUrl =
        typeof item.previewImageUrl === "string" ? item.previewImageUrl.trim() : "";
      if (!originalContentUrl.startsWith("https://")) {
        throw new BadRequestException("Image originalContentUrl must be a valid HTTPS URL");
      }
      if (!previewImageUrl.startsWith("https://")) {
        throw new BadRequestException("Image previewImageUrl must be a valid HTTPS URL");
      }
      return {
        type: "image",
        originalContentUrl,
        previewImageUrl,
        ...(typeof item.originalObjectKey === "string" && item.originalObjectKey.trim()
          ? { originalObjectKey: item.originalObjectKey.trim() }
          : {}),
        ...(typeof item.previewObjectKey === "string" && item.previewObjectKey.trim()
          ? { previewObjectKey: item.previewObjectKey.trim() }
          : {}),
      };
    }
    if (item.type === "rich_message") {
      const richMessageId =
        typeof item.richMessageId === "string" ? item.richMessageId.trim() : "";
      if (!richMessageId) {
        throw new BadRequestException("Rich Message ID is required");
      }
      return { type: "rich_message", richMessageId };
    }
    throw new BadRequestException("Unsupported broadcast message type: " + String(item.type));
  });
}

export function normalizeBroadcastAdvanced(input?: BroadcastAdvancedInput): Required<BroadcastAdvancedInput> {
  const allowPartial = input?.allowPartial !== false;
  const rawMax = input?.maxVolume;
  if (rawMax !== undefined && rawMax !== null && (!Number.isInteger(rawMax) || rawMax <= 0)) {
    throw new BadRequestException("maxVolume must be a positive integer");
  }
  return {
    allowPartial,
    maxVolume: rawMax ?? null,
  };
}

export function resolveScheduledAt(input?: BroadcastScheduleInput): Date | null {
  if (!input || input.mode === "NOW") return null;
  if (input.mode !== "SCHEDULED" || !input.scheduledAt) {
    throw new BadRequestException("scheduledAt is required for scheduled broadcasts");
  }
  const date = new Date(input.scheduledAt);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("scheduledAt must be a valid ISO date/time");
  }
  if (date.getTime() <= Date.now() + 10_000) {
    throw new BadRequestException("Scheduled broadcast time must be in the future");
  }
  return date;
}
