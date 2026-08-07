import { ActionType } from "../action-agent.types";

export function formatActionTitle(actionType: ActionType, storeName: string): string {
  switch (actionType) {
    case ActionType.ASSIGN_SUPPORT:
      return `Reallocate float support staff during peak traffic hours at ${storeName}`;
    case ActionType.NOTIFY_BM:
      return `Dispatch automated urgent Branch Manager notification for ${storeName}`;
    case ActionType.ESCALATE_MANAGER:
      return `Escalate response SLA breach to Area Operational Director for ${storeName}`;
    case ActionType.CREATE_TASK:
      return `Create operational shift review task for ${storeName}`;
    case ActionType.FOLLOW_UP:
    default:
      return `Schedule 30-minute response velocity follow-up check for ${storeName}`;
  }
}

export function formatActionOwner(actionType: ActionType): string {
  switch (actionType) {
    case ActionType.ASSIGN_SUPPORT:
    case ActionType.CREATE_TASK:
      return "Area Manager";
    case ActionType.NOTIFY_BM:
    case ActionType.FOLLOW_UP:
      return "Branch Manager";
    case ActionType.ESCALATE_MANAGER:
    default:
      return "Head Office Admin";
  }
}
