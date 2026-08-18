import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { AppVersionController } from "./app-version.controller";
import { AppVersionService } from "./app-version.service";

@Module({
  imports: [PrismaModule],
  controllers: [AppVersionController],
  providers: [AppVersionService],
  exports: [AppVersionService],
})
export class AppVersionModule {}
