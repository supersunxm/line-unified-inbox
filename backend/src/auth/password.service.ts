import { Injectable } from "@nestjs/common";
import { randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(nodeScrypt);

@Injectable()
export class PasswordService {
  async hash(password: string) {
    const salt = randomBytes(16);
    const derived = await scrypt(password, salt, 64) as Buffer;
    return `scrypt:${salt.toString("base64")}:${derived.toString("base64")}`;
  }
  async verify(password: string, stored: string) {
    const [version, saltValue, hashValue] = stored.split(":");
    if (version !== "scrypt" || !saltValue || !hashValue) return false;
    const expected = Buffer.from(hashValue, "base64");
    const actual = await scrypt(password, Buffer.from(saltValue, "base64"), expected.length) as Buffer;
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }
}
