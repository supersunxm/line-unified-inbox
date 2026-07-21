import { Global, Module } from "@nestjs/common";
import { LineProfileService } from "./line-profile.service";

@Global()
@Module({ providers: [LineProfileService], exports: [LineProfileService] })
export class LineProfileModule {}
