import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma.module";
import { Review15VisionController } from "./review15-vision.controller";
import { Review15VisionService } from "./review15-vision.service";
import { Review15VisitorsController } from "./review15-visitors.controller";
import { Review15VisitorsService } from "./review15-visitors.service";

@Module({
  imports: [PrismaModule],
  controllers: [Review15VisionController, Review15VisitorsController],
  providers: [Review15VisionService, Review15VisitorsService],
})
export class Review15VisionModule {}
