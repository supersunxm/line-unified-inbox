import { IsIn, IsOptional } from "class-validator";
import { translationTargetLanguages, TranslationTargetLanguage } from "./create-message-translation.dto";

export const translationFeedbackRatings = ["HELPFUL", "INCORRECT"] as const;
export type TranslationFeedbackRatingInput = (typeof translationFeedbackRatings)[number];
export const translationFeedbackIssueCategories = ["meaning_issue", "terminology_issue", "other"] as const;
export type TranslationFeedbackIssueCategoryInput = (typeof translationFeedbackIssueCategories)[number];

export class CreateTranslationFeedbackDto {
  @IsIn(translationTargetLanguages)
  targetLanguage!: TranslationTargetLanguage;

  @IsIn(translationFeedbackRatings)
  rating!: TranslationFeedbackRatingInput;

  @IsOptional()
  @IsIn(translationFeedbackIssueCategories)
  issueCategory?: TranslationFeedbackIssueCategoryInput;
}
