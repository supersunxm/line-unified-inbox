import { Global, Module } from "@nestjs/common";
import { LineImageService } from "./line-image.service";
import { MediaStorageService } from "./media-storage";
import { MediaController } from "./media.controller";
import { AuthModule } from "../auth/auth.module";

@Global()
@Module({ imports: [AuthModule], controllers: [MediaController], providers: [MediaStorageService, LineImageService], exports: [MediaStorageService, LineImageService] })
export class MediaModule {}
