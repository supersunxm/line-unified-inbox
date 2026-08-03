import { IsIn } from "class-validator";

export const translationTargetLanguages = ["en", "zh"] as const;
export type TranslationTargetLanguage = (typeof translationTargetLanguages)[number];

export class CreateMessageTranslationDto {
  @IsIn(translationTargetLanguages)
  targetLanguage!: TranslationTargetLanguage;
}
