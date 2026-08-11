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
import { OtpChallengeService } from "./otp-challenge.service";
import { RegistrationService } from "./registration.service";
import { RegistrationController } from "./registration.controller";
import { AdminRegistrationController } from "./admin-registration.controller";

@Module({ imports: [EmailModule], controllers: [AuthController, RegistrationController, AdminRegistrationController], providers: [PasswordService, AuthService, SetupService, DevAdminService, PilotAdminBootstrapService, StoreAccessService, OtpChallengeService, RegistrationService, { provide: APP_GUARD, useClass: AuthGuard }], exports: [PasswordService, AuthService, StoreAccessService] })
export class AuthModule {}
