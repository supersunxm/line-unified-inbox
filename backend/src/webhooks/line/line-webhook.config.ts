import { Injectable, OnModuleInit } from "@nestjs/common";

@Injectable()
export class LineWebhookConfig implements OnModuleInit {
  readonly enabled = process.env.LINE_WEBHOOK_ENABLED === "true";
  readonly publicWebhookBaseUrl = process.env.PUBLIC_WEBHOOK_BASE_URL || undefined;

  onModuleInit() {
    const rawEnabled = process.env.LINE_WEBHOOK_ENABLED ?? "false";
    if (rawEnabled !== "true" && rawEnabled !== "false") throw new Error("LINE_WEBHOOK_ENABLED must be true or false");
    // Signature credentials are resolved only from the persisted per-OA webhook key.
  }
}
