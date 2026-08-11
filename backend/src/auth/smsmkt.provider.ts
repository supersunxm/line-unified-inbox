import { Injectable } from "@nestjs/common";
import { SmsDeliveryResult, SmsProvider } from "./sms-provider";

@Injectable()
export class SmsMktProvider implements SmsProvider {
  sendSms(phoneNumber: string, message: string): Promise<SmsDeliveryResult> {
    void phoneNumber;
    void message;
    const apiKey = process.env.SMS_API_KEY?.trim();
    const apiSecret = process.env.SMS_API_SECRET?.trim();
    const sender = process.env.SMS_SENDER?.trim();
    if (!apiKey || !apiSecret || !sender) return Promise.resolve({ status: "NOT_CONFIGURED", reason: "SMS credentials are missing" });
    return Promise.resolve({ status: "NOT_CONFIGURED", reason: "SmsMkt transport is not configured" });
  }
}
