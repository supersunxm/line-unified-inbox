import { Global, Module } from "@nestjs/common";
import { LineProfileRefreshService } from "./line-profile-refresh.service";
import { LineProfileService } from "./line-profile.service";

@Global()
@Module({ providers: [LineProfileService, LineProfileRefreshService], exports: [LineProfileService] })
export class LineProfileModule {}
