import { Global, Module } from "@nestjs/common";
import { ClassificationService } from "./classification.service";
import { CustomerSignalClassifierService } from "./customer-signal-classifier.service";

@Global()
@Module({
  providers: [ClassificationService, CustomerSignalClassifierService],
  exports: [ClassificationService, CustomerSignalClassifierService],
})
export class ClassificationModule {}
