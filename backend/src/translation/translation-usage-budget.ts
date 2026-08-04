import { TranslationConfig } from "./translation.config";

export type TranslationUsageBudgetSnapshot = {
  dailyCharacterUsage: number;
  dailyCharacterLimit: number;
  budgetExceededRequests: number;
};

export function bangkokCalendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export class TranslationUsageBudget {
  private dateKey: string;
  private dailyCharacterUsage = 0;
  private budgetExceededRequests = 0;

  constructor(private readonly config: TranslationConfig, private readonly now: () => Date = () => new Date()) {
    this.dateKey = bangkokCalendarDate(this.now());
  }

  consume(characterCount: number): boolean {
    this.resetForNewBangkokDay();
    if (this.dailyCharacterUsage + characterCount > this.config.dailyCharacterLimit) {
      this.budgetExceededRequests += 1;
      return false;
    }
    this.dailyCharacterUsage += characterCount;
    return true;
  }

  snapshot(): TranslationUsageBudgetSnapshot {
    this.resetForNewBangkokDay();
    return {
      dailyCharacterUsage: this.dailyCharacterUsage,
      dailyCharacterLimit: this.config.dailyCharacterLimit,
      budgetExceededRequests: this.budgetExceededRequests,
    };
  }

  private resetForNewBangkokDay(): void {
    const currentDateKey = bangkokCalendarDate(this.now());
    if (currentDateKey === this.dateKey) return;
    this.dateKey = currentDateKey;
    this.dailyCharacterUsage = 0;
    this.budgetExceededRequests = 0;
  }
}
