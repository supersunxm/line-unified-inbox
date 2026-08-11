export type SmsDeliveryStatus = "SENT" | "NOT_CONFIGURED" | "FAILED";

export type SmsDeliveryResult = {
  status: SmsDeliveryStatus;
  reason?: string;
};

export interface SmsProvider {
  sendSms(phoneNumber: string, message: string): Promise<SmsDeliveryResult>;
}

export const SMS_PROVIDER = Symbol("SMS_PROVIDER");
