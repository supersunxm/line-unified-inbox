export const MAX_LINE_CHAT_NICKNAME_LENGTH = 20;

export type LineChatNicknameInput = {
  status?: "ONLINE" | "INTERESTED" | "PURCHASED" | null;
  paymentMethod?: "CASH" | "INSTALLMENT" | "CREDIT_CARD" | "OTHER" | null;
  recordedAt?: Date | string | null;
  products?: readonly {
    customProductName?: string | null;
    model?: { name?: string | null } | null;
  }[] | null;
};

const BANGKOK_MONTH_YEAR = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Bangkok",
  month: "2-digit",
  year: "2-digit",
});

function conciseModelName(value: string): string {
  return value.trim().replace(/^OPPO\s+/i, "");
}

/**
 * Deterministically compacts a model name so that `${model}${suffix}` satisfies the 20-char limit.
 *
 * Compaction order:
 * 1. If length <= 20: return unchanged.
 * 2. Remove redundant network suffix (" 5G", "(5G)", "-5G", case-insensitive) from model name.
 * 3. Remove unnecessary symbols (+, (, )).
 * 4. Compact whitespace inside model name only (e.g. "Reno16 Pro" -> "Reno16Pro").
 * 5. Truncate ONLY the model portion to the remaining available character budget.
 *
 * Never truncates or removes paymentLabel (สด/ผ่อน) or month/year (MM/YY).
 */
export function compactModelNameToFit(
  rawModelName: string,
  suffix: string,
  maxLength: number = MAX_LINE_CHAT_NICKNAME_LENGTH,
): string {
  let model = rawModelName.trim();
  if (`${model}${suffix}`.length <= maxLength) {
    return model;
  }

  // Step 2: Remove redundant network suffix
  const without5g = model
    .replace(/(?:\s*\(5g\)|(?:\s+|-|_)5g\b)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (without5g.length > 0) {
    model = without5g;
    if (`${model}${suffix}`.length <= maxLength) {
      return model;
    }
  }

  // Step 3: Remove unnecessary symbols (+, (, ))
  const withoutSymbols = model
    .replace(/[+()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (withoutSymbols.length > 0) {
    model = withoutSymbols;
    if (`${model}${suffix}`.length <= maxLength) {
      return model;
    }
  }

  // Step 4: Compact whitespace inside model name only
  const withoutSpaces = model.replace(/\s+/g, "");
  if (withoutSpaces.length > 0) {
    model = withoutSpaces;
    if (`${model}${suffix}`.length <= maxLength) {
      return model;
    }
  }

  // Step 5: Truncate ONLY the model portion to the remaining budget
  const maxModelBudget = Math.max(0, maxLength - suffix.length);
  const truncated = model.slice(0, maxModelBudget).trim();
  return truncated.length > 0 ? truncated : model.slice(0, maxModelBudget);
}

/**
 * Builds the nickname that should be mirrored to LINE Official Account chat.
 *
 * Business rules:
 * - ONLINE -> "Online"
 * - PURCHASED -> "<compactModel> <สด|ผ่อน> <MM/YY>"
 * - Other states do not change the LINE nickname.
 * - Guarantees output length <= 20 characters while preserving model identity,
 *   payment method (สด/ผ่อน), and month/year (MM/YY).
 *
 * The purchase date is the persisted sales record timestamp, not the client
 * clock. Month/year is rendered in the Thailand business timezone so Railway
 * or another UTC runtime cannot shift saves around a month boundary.
 */
export function buildLineChatNickname(input: LineChatNicknameInput): string | null {
  if (input.status === "ONLINE") return "Online";
  if (input.status !== "PURCHASED") return null;

  const firstProduct = input.products?.[0];
  const rawModelName = firstProduct?.customProductName?.trim() || firstProduct?.model?.name?.trim();
  if (!rawModelName) return null;
  const modelName = conciseModelName(rawModelName);
  if (!modelName) return null;

  const paymentLabel = input.paymentMethod === "CASH"
    ? "สด"
    : input.paymentMethod === "INSTALLMENT"
      ? "ผ่อน"
      : null;
  if (!paymentLabel) return null;

  if (!input.recordedAt) return null;
  const recordedAt = input.recordedAt instanceof Date ? input.recordedAt : new Date(input.recordedAt);
  if (Number.isNaN(recordedAt.getTime())) return null;

  const parts = BANGKOK_MONTH_YEAR.formatToParts(recordedAt);
  const month = parts.find((part) => part.type === "month")?.value;
  const year = parts.find((part) => part.type === "year")?.value;
  if (!month || !year) return null;

  const suffix = ` ${paymentLabel} ${month}/${year}`;
  const compactModel = compactModelNameToFit(modelName, suffix, MAX_LINE_CHAT_NICKNAME_LENGTH);

  return `${compactModel}${suffix}`;
}
