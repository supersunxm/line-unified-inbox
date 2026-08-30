export type LineChatNicknameInput = {
  status?: "ONLINE" | "INTERESTED" | "PURCHASED" | null;
  paymentMethod?: "CASH" | "INSTALLMENT" | "CREDIT_CARD" | "OTHER" | null;
  recordedAt?: Date | string | null;
  products?: readonly {
    customProductName?: string | null;
    model?: { name?: string | null } | null;
  }[] | null;
};

/**
 * Builds the nickname that should be mirrored to LINE Official Account chat.
 *
 * Business rules:
 * - ONLINE -> "Online"
 * - PURCHASED -> "<model> <สด|ผ่อน> <MM/YY>"
 * - Other states do not change the LINE nickname.
 *
 * The purchase date is the persisted sales record timestamp, not the client
 * clock. A purchase nickname is only emitted when all required data exists.
 */
export function buildLineChatNickname(input: LineChatNicknameInput): string | null {
  if (input.status === "ONLINE") return "Online";
  if (input.status !== "PURCHASED") return null;

  const firstProduct = input.products?.[0];
  const modelName = firstProduct?.customProductName?.trim() || firstProduct?.model?.name?.trim();
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

  const month = String(recordedAt.getMonth() + 1).padStart(2, "0");
  const year = String(recordedAt.getFullYear()).slice(-2);
  return `${modelName} ${paymentLabel} ${month}/${year}`;
}
