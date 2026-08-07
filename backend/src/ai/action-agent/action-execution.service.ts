import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class ActionExecutionService {
  private readonly logger = new Logger(ActionExecutionService.name);

  async notifyBM(storeId: string, storeName: string): Promise<{ success: boolean; mode: "SIMULATION" }> {
    this.logger.log(`[SIMULATION] Dispatching urgent Branch Manager notification for store ${storeName} (${storeId})`);
    return { success: true, mode: "SIMULATION" };
  }

  async assignSupport(storeId: string, storeName: string): Promise<{ success: boolean; mode: "SIMULATION" }> {
    this.logger.log(`[SIMULATION] Reallocating float support responder for store ${storeName} (${storeId})`);
    return { success: true, mode: "SIMULATION" };
  }

  async escalateManager(storeId: string, storeName: string): Promise<{ success: boolean; mode: "SIMULATION" }> {
    this.logger.log(`[SIMULATION] Escalating SLA breach to Area Manager for store ${storeName} (${storeId})`);
    return { success: true, mode: "SIMULATION" };
  }

  async createFollowUp(taskId: string): Promise<{ success: boolean; mode: "SIMULATION" }> {
    this.logger.log(`[SIMULATION] Creating 30-minute operational follow-up check for task ${taskId}`);
    return { success: true, mode: "SIMULATION" };
  }
}
