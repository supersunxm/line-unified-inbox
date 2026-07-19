import { Injectable, OnModuleInit } from "@nestjs/common";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

@Injectable()
export class CredentialEncryptionService implements OnModuleInit {
  private key!: Buffer;

  onModuleInit() {
    const encoded = process.env.LINE_CREDENTIAL_ENCRYPTION_KEY ?? "";
    const key = Buffer.from(encoded, "base64");
    if (key.length !== 32 || key.toString("base64") !== encoded) {
      throw new Error("LINE_CREDENTIAL_ENCRYPTION_KEY must be exactly 32 bytes encoded as Base64");
    }
    this.key = key;
  }

  encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ciphertext.toString("base64")].join(":");
  }

  decrypt(value: string): string {
    const [version, ivValue, tagValue, ciphertextValue] = value.split(":");
    if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Encrypted credential format is invalid");
    const decipher = createDecipheriv("aes-256-gcm", this.key, Buffer.from(ivValue, "base64"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64")), decipher.final()]).toString("utf8");
  }
}
