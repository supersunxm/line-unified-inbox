import { Injectable } from "@nestjs/common";
import { emailFromAddress } from "../email.config";
import type { EmailMessage, EmailProvider } from "../email-provider";

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const fromAddress = emailFromAddress();
    if (!apiKey || !fromAddress) throw new Error("Email provider is not configured");

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from: `${process.env.EMAIL_FROM_NAME?.trim() || "OPPO LINE OA Monitor"} <${fromAddress}>`,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    });
    if (!response.ok) throw new Error("Email provider rejected the request");
  }
}
