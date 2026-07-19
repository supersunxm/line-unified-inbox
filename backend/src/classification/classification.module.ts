import { Global, Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { ClassificationService } from "./classification.service";

@Global()
@Module({ providers: [PrismaService, ClassificationService], exports: [ClassificationService] })
export class ClassificationModule {}
