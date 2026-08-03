import { Module } from "@nestjs/common";
import { TranslationConfig } from "./translation.config";
import { TranslationController } from "./translation.controller";
import { TranslationService } from "./translation.service";
import { GoogleTranslationProvider } from "./providers/google-translation.provider";
import { TRANSLATION_PROVIDER, TranslationProvider } from "./translation.provider";

@Module({
  controllers: [TranslationController],
  providers: [
    TranslationConfig,
    {
      provide: TRANSLATION_PROVIDER,
      inject: [TranslationConfig],
      useFactory: (config: TranslationConfig): TranslationProvider | null => config.provider === "google" && config.google ? new GoogleTranslationProvider(config.google) : null,
    },
    TranslationService,
  ],
  exports: [TranslationService],
})
export class TranslationModule {}
