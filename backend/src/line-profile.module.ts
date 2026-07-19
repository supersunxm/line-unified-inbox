import { Global, Module } from "@nestjs/common";
import { LineProfileService } from "./line-profile.service";
import { PrismaService } from "./prisma.service";

@Global()
@Module({ providers: [PrismaService, LineProfileService], exports: [LineProfileService] })
export class LineProfileModule {}
