export enum ActionType {
  NOTIFY_BM = "NOTIFY_BM",
  ASSIGN_SUPPORT = "ASSIGN_SUPPORT",
  ESCALATE_MANAGER = "ESCALATE_MANAGER",
  CREATE_TASK = "CREATE_TASK",
  FOLLOW_UP = "FOLLOW_UP",
}

export type ActionStatus = "PENDING_APPROVAL" | "APPROVED" | "EXECUTING" | "COMPLETED";

export interface OperationalActionTask {
  id: string;
  storeId: string;
  storeName: string;
  problem: string;
  rootCause: string;
  actionType: ActionType;
  recommendedAction: string;
  owner: string;
  deadline: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM";
  status: ActionStatus;
  expectedImpact: string;
  createdAt: string;
}
