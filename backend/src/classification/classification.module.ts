import { Global, Module } from "@nestjs/common";
import { ClassificationService } from "./classification.service";

@Global()
@Module({ providers: [ClassificationService], exports: [ClassificationService] })
export class ClassificationModule {}
