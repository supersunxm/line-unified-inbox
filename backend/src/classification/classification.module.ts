import { Global, Module } from "@nestjs/common";
import { ClassificationService } from "./classification.service";
import { CustomerSignalClassifierService } from "./customer-signal-classifier.service";
import { ProductAccuracyService } from "./product-accuracy.service";
import { ProductCorrectionInsightService } from "./product-correction-insight.service";
import { ProductIntelligenceController } from "./product-intelligence.controller";

@Global()
@Module({
  controllers: [ProductIntelligenceController],
  providers: [
    ClassificationService,
    CustomerSignalClassifierService,
    ProductAccuracyService,
    ProductCorrectionInsightService,
  ],
  exports: [
    ClassificationService,
    CustomerSignalClassifierService,
    ProductAccuracyService,
    ProductCorrectionInsightService,
  ],
})
export class ClassificationModule {}
