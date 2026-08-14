import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { randomInt } from "node:crypto";
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
import { MobileAuthService } from "./mobile-auth.service";
import { OTP_CODE_GENERATOR } from "./otp-challenge.service";
import { DevelopmentSmsProvider } from "./development-sms.provider";
import { SmsMktProvider } from "./smsmkt.provider";
import { SMS_PROVIDER } from "./sms-provider";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuditLogService } from "./audit-log.service";
import { AdminAuditLogController } from "./admin-audit-log.controller";

@Module({ imports: [EmailModule], controllers: [AuthController, RegistrationController, AdminRegistrationController, AdminAuditLogController], providers: [PasswordService, AuthService, AuthRateLimitService, AuditLogService, SetupService, DevAdminService, PilotAdminBootstrapService, StoreAccessService, { provide: OTP_CODE_GENERATOR, useValue: () => randomInt(0, 1_000_000).toString().padStart(6, "0") }, { provide: SMS_PROVIDER, useFactory: () => process.env.NODE_ENV === "production" || process.env.SMS_PROVIDER === "smsmkt" ? new SmsMktProvider() : new DevelopmentSmsProvider() }, OtpChallengeService, RegistrationService, MobileAuthService, { provide: APP_GUARD, useClass: AuthGuard }], exports: [PasswordService, AuthService, StoreAccessService, AuditLogService] })
export class AuthModule {}
