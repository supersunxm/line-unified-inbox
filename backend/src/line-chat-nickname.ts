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
 * Builds the nickname that should be mirrored to LINE Official Account chat.
 *
 * Business rules:
 * - ONLINE -> "Online"
 * - PURCHASED -> "<model> <สด|ผ่อน> <MM/YY>"
 * - Other states do not change the LINE nickname.
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

  return `${modelName} ${paymentLabel} ${month}/${year}`;
}
