import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { PrismaService } from "../prisma.service";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { SetupService } from "./setup.service";
import { EmailModule } from "../email/email.module";
import { DevAdminService } from "./dev-admin.service";

@Module({ imports: [EmailModule], controllers: [AuthController], providers: [PrismaService, PasswordService, AuthService, SetupService, DevAdminService, { provide: APP_GUARD, useClass: AuthGuard }], exports: [PasswordService, AuthService] })
export class AuthModule {}
