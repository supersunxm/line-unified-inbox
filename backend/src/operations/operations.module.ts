import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { OperationsService } from "./operations.service";

@Module({
  imports: [PrismaModule],
  providers: [OperationsService],
  exports: [OperationsService],
})
export class OperationsModule {}
