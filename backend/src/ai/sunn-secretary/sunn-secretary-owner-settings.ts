import { ForbiddenException } from "@nestjs/common";
import type { AuthUser } from "../../auth/auth.guard";

/** Canonical session user ID only; never authorize by display name, email or employee ID. */
export function assertSunnSecretaryOwner(user: AuthUser | undefined, configuredOwnerId: string | undefined): void {
  if (!user || !configuredOwnerId?.trim() || user.id !== configuredOwnerId.trim() ||
      user.role !== "ADMIN" || !user.isActive || user.storeContext) {
    throw new ForbiddenException("Sunn Secretary owner access denied");
  }
}

export type SunnSecretarySetupStatus = {
  channelIdConfigured: boolean;
  channelSecretConfigured: boolean;
  accessTokenConfigured: boolean;
  botUserIdConfigured: boolean;
  webhookEnabled: boolean;
  webhookUrl: string;
};

/** Return presence only: credentials are never sent to the browser. */
export function sunnSecretarySetupStatus(env: NodeJS.ProcessEnv): SunnSecretarySetupStatus {
  return {
    channelIdConfigured: Boolean(env.SUNN_SECRETARY_CHANNEL_ID?.trim()),
    channelSecretConfigured: Boolean(env.SUNN_SECRETARY_CHANNEL_SECRET?.trim()),
    accessTokenConfigured: Boolean(env.SUNN_SECRETARY_CHANNEL_ACCESS_TOKEN?.trim()),
    botUserIdConfigured: Boolean(env.SUNN_SECRETARY_BOT_USER_ID?.trim()),
    webhookEnabled: env.SUNN_SECRETARY_WEBHOOK_ENABLED === "true",
    webhookUrl: "https://lineoppo.click/sunn-secretary/webhook",
  };
}
