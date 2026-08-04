import { Injectable, Logger } from "@nestjs/common";
import { TranslationTargetLanguage } from "./dto/create-message-translation.dto";
import { TranslationProviderName } from "./translation.config";

export type TranslationAuditEntry = {
  messageId: string;
  actingUserId: string;
  targetLanguage: TranslationTargetLanguage;
  provider: TranslationProviderName;
  status: string;
  durationMs: number;
  characterCount?: number;
  errorCategory?: string;
};

export type TranslationPilotAccessAuditEntry = {
  actingUserId: string;
  reasonCategory: "ADMIN_NOT_ALLOWLISTED";
  timestamp: string;
};

@Injectable()
export class TranslationAuditLogger {
  private readonly logger = new Logger("TranslationAudit");

  record(entry: TranslationAuditEntry): void {
    const safeEntry: TranslationAuditEntry = {
      messageId: entry.messageId,
      actingUserId: entry.actingUserId,
      targetLanguage: entry.targetLanguage,
      provider: entry.provider,
      status: entry.status,
      durationMs: entry.durationMs,
      ...(entry.characterCount === undefined ? {} : { characterCount: entry.characterCount }),
      ...(entry.errorCategory === undefined ? {} : { errorCategory: entry.errorCategory }),
    };
    if (safeEntry.errorCategory) this.logger.warn(safeEntry);
    else this.logger.log(safeEntry);
  }

  recordPilotAccessBlocked(actingUserId: string): void {
    const entry: TranslationPilotAccessAuditEntry = {
      actingUserId,
      reasonCategory: "ADMIN_NOT_ALLOWLISTED",
      timestamp: new Date().toISOString(),
    };
    this.logger.warn(entry);
  }
}
