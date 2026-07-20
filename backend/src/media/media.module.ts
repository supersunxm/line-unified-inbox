import { Global, Module } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { LineImageService } from "./line-image.service";
import { MediaStorageService } from "./media-storage";
import { MediaController } from "./media.controller";

@Global()
@Module({ controllers: [MediaController], providers: [PrismaService, MediaStorageService, LineImageService], exports: [MediaStorageService, LineImageService] })
export class MediaModule {}
