export type PriorityMessageDirection = "INBOUND" | "OUTBOUND" | "SYSTEM";

export type PriorityReasonCode =
  | "NEEDS_REPLY"
  | "WAITING_4_TO_12H"
  | "WAITING_12_TO_24H"
  | "WAITING_OVER_24H"
  | "INSTALLMENT_CUSTOMER"
  | "MANUAL_PRODUCT_TAG"
  | "MULTIPLE_UNANSWERED_INBOUND";

export type OperationalPriorityLevel = "NONE" | "NORMAL" | "HIGH" | "URGENT";

export type PriorityMessage = {
  id?: string;
  direction: PriorityMessageDirection;
  sentAt: Date;
  senderUserId: string | null;
};

export type PriorityContext = {
  bmReplyStatus: string;
  isInstallment: boolean;
  hasManualProductTag: boolean;
  messages: PriorityMessage[];
};

export type CalculatedPriority = {
  score: number;
  level: OperationalPriorityLevel;
  waitingSeconds: number;
  waitingSince: Date | null;
  reasons: PriorityReasonCode[];
};

/** Public response shape. The internal score is intentionally not exposed. */
export type OperationalPriority = Omit<CalculatedPriority, "score" | "waitingSince"> & {
  waitingSince: string | null;
};
