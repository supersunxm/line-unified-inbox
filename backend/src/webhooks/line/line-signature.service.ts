import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

@Injectable()
export class LineSignatureService {
  verify(rawBody: Buffer, signature: string, secret: string): boolean {
    if (!signature || !secret || rawBody.length === 0) return false;
    const expected = createHmac("sha256", secret).update(rawBody).digest();
    let received: Buffer;
    try { received = Buffer.from(signature, "base64"); } catch { return false; }
    return received.length === expected.length && timingSafeEqual(received, expected);
  }
}
