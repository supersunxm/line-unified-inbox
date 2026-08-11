import { Injectable } from "@nestjs/common";
import { SmsDeliveryResult, SmsProvider } from "./sms-provider";

@Injectable()
export class DevelopmentSmsProvider implements SmsProvider {
  sendSms(phoneNumber: string, message: string): Promise<SmsDeliveryResult> {
    if (process.env.NODE_ENV === "production") return Promise.resolve({ status: "NOT_CONFIGURED" });
    if (process.env.OTP_DEBUG === "true") console.log("[SMS_DEBUG]", { phone: phoneNumber, message });
    return Promise.resolve({ status: "SENT" });
  }
}
