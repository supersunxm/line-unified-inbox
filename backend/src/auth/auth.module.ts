import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { SetupService } from "./setup.service";
import { EmailModule } from "../email/email.module";
import { DevAdminService } from "./dev-admin.service";
import { PilotAdminBootstrapService } from "./pilot-admin-bootstrap.service";
import { StoreAccessService } from "./store-access.service";

@Module({ imports: [EmailModule], controllers: [AuthController], providers: [PasswordService, AuthService, SetupService, DevAdminService, PilotAdminBootstrapService, StoreAccessService, { provide: APP_GUARD, useClass: AuthGuard }], exports: [PasswordService, AuthService, StoreAccessService] })
export class AuthModule {}
