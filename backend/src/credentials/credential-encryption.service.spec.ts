import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { CredentialEncryptionService } from "./credential-encryption.service";

function serviceWithKey(key: Buffer) {
  process.env.LINE_CREDENTIAL_ENCRYPTION_KEY = key.toString("base64");
  const service = new CredentialEncryptionService();
  service.onModuleInit();
  return service;
}

void test("encrypts and decrypts a credential with AES-256-GCM", () => {
  const service = serviceWithKey(randomBytes(32));
  const encrypted = service.encrypt("channel-secret");
  assert.notEqual(encrypted, "channel-secret");
  assert.equal(service.decrypt(encrypted), "channel-secret");
});

void test("wrong encryption key cannot decrypt a credential", () => {
  const encrypted = serviceWithKey(randomBytes(32)).encrypt("channel-secret");
  assert.throws(() => serviceWithKey(randomBytes(32)).decrypt(encrypted));
});

void test("corrupted ciphertext is rejected", () => {
  const service = serviceWithKey(randomBytes(32));
  const encrypted = service.encrypt("channel-secret");
  assert.throws(() => service.decrypt(`${encrypted.slice(0, -2)}aa`));
});

void test("invalid key length is rejected", () => {
  process.env.LINE_CREDENTIAL_ENCRYPTION_KEY = Buffer.from("short").toString("base64");
  assert.throws(() => new CredentialEncryptionService().onModuleInit());
});
