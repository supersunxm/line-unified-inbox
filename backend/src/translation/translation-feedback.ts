import { BadRequestException, Injectable } from "@nestjs/common";

export const translationFeedbackSignals = ["POSITIVE", "TERMINOLOGY_ISSUE", "MEANING_ISSUE", "OTHER"] as const;
export type TranslationFeedbackSignal = (typeof translationFeedbackSignals)[number];
export type FeedbackEligibleTranslationStatus = "TRANSLATED" | "CACHED";

export type TranslationFeedbackSnapshot = {
  positiveFeedbackCount: number;
  terminologyIssueCount: number;
  meaningIssueCount: number;
  otherIssueCount: number;
};

@Injectable()
export class TranslationFeedbackService {
  private positiveFeedbackCount = 0;
  private terminologyIssueCount = 0;
  private meaningIssueCount = 0;
  private otherIssueCount = 0;

  recordAfterSuccessfulTranslation(status: string, signal: TranslationFeedbackSignal): void {
    if (status !== "TRANSLATED" && status !== "CACHED") throw new BadRequestException("Translation feedback requires a successful translation");
    if (signal === "POSITIVE") this.positiveFeedbackCount += 1;
    if (signal === "TERMINOLOGY_ISSUE") this.terminologyIssueCount += 1;
    if (signal === "MEANING_ISSUE") this.meaningIssueCount += 1;
    if (signal === "OTHER") this.otherIssueCount += 1;
  }

  snapshot(): TranslationFeedbackSnapshot {
    return {
      positiveFeedbackCount: this.positiveFeedbackCount,
      terminologyIssueCount: this.terminologyIssueCount,
      meaningIssueCount: this.meaningIssueCount,
      otherIssueCount: this.otherIssueCount,
    };
  }
}
