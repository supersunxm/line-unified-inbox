import { Global, Module } from "@nestjs/common";
import { LineImageService } from "./line-image.service";
import { MediaStorageService } from "./media-storage";
import { MediaController } from "./media.controller";

@Global()
@Module({ controllers: [MediaController], providers: [MediaStorageService, LineImageService], exports: [MediaStorageService, LineImageService] })
export class MediaModule {}
