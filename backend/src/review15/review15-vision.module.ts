import { Module } from "@nestjs/common";
import { Review15VisionController } from "./review15-vision.controller";
import { Review15VisionService } from "./review15-vision.service";

@Module({
  controllers: [Review15VisionController],
  providers: [Review15VisionService],
})
export class Review15VisionModule {}
