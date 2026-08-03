import assert from "node:assert/strict";
import test from "node:test";
import { GoogleTranslationClient, GoogleTranslationProvider } from "./google-translation.provider";
import { TranslationProviderError } from "../translation.provider";

const credentials = { client_email: "benchmark@example.test", private_key: "synthetic-private-key" };

test("Google adapter maps English response to the normalized provider result", async () => {
  let captured: unknown;
  const client: GoogleTranslationClient = {
    async translateText(request) {
      captured = request;
      return [{ translations: [{ translatedText: "English result", detectedLanguageCode: "th" }] }];
    },
  };
  const provider = new GoogleTranslationProvider({ projectId: "synthetic-project", credentials, client });
  assert.deepEqual(await provider.translate("ข้อความ😀", "en"), { translatedText: "English result", detectedLanguage: "th", characterCount: 8, provider: "google" });
  assert.deepEqual(captured, { parent: "projects/synthetic-project/locations/global", contents: ["ข้อความ😀"], mimeType: "text/plain", sourceLanguageCode: "th", targetLanguageCode: "en" });
});

test("Google adapter maps zh to Simplified Chinese", async () => {
  const client: GoogleTranslationClient = { async translateText(request) { assert.equal(request.targetLanguageCode, "zh-CN"); return [{ translations: [{ translatedText: "中文结果" }] }]; } };
  const provider = new GoogleTranslationProvider({ projectId: "synthetic-project", credentials, client });
  assert.equal((await provider.translate("ข้อความ", "zh")).translatedText, "中文结果");
});

test("Google adapter rejects empty responses without exposing the raw payload", async () => {
  const client: GoogleTranslationClient = { async translateText() { return [{ translations: [{ translatedText: "" }] }]; } };
  const provider = new GoogleTranslationProvider({ projectId: "synthetic-project", credentials, client });
  await assert.rejects(provider.translate("ข้อความ", "en"), (error: unknown) => {
    assert.ok(error instanceof TranslationProviderError);
    assert.equal(error.category, "EMPTY_RESPONSE");
    assert.equal(error.message, "Translation provider request failed");
    assert.equal(JSON.stringify(error).includes("translations"), false);
    return true;
  });
});

test("Google adapter sanitizes provider errors and does not retain raw error payloads", async () => {
  const client: GoogleTranslationClient = { async translateText() { throw new Error("raw-provider-secret-payload"); } };
  const provider = new GoogleTranslationProvider({ projectId: "synthetic-project", credentials, client });
  await assert.rejects(provider.translate("ข้อความ", "en"), (error: unknown) => {
    assert.ok(error instanceof TranslationProviderError);
    assert.equal(error.category, "PROVIDER_REQUEST_FAILED");
    assert.equal(error.message.includes("raw-provider-secret-payload"), false);
    assert.equal(JSON.stringify(error).includes("raw-provider-secret-payload"), false);
    return true;
  });
});
