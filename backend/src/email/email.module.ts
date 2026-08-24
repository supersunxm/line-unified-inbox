import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { EMAIL_PROVIDER } from "./email-provider";
import { ResendEmailProvider } from "./providers/resend-email.provider";

@Module({ providers: [ResendEmailProvider, { provide: EMAIL_PROVIDER, useExisting: ResendEmailProvider }, EmailService], exports: [EmailService] })
export class EmailModule {}
