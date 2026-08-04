import { loadEnvFile } from "node:process";
import { TranslationGlossarySmokeTest } from "../src/translation/glossary/translation-glossary-smoke-test";
import { GoogleTranslationProvider } from "../src/translation/providers/google-translation.provider";
import { readGoogleTranslationProviderOptions } from "../src/translation/translation.config";

try { loadEnvFile(".env"); } catch { /* Managed runtimes may inject configuration directly. */ }

const failedResult = { providerCalls: 0, termsTested: 7, termsPreserved: false, success: false };

async function main() {
  const options = readGoogleTranslationProviderOptions();
  if (!options) {
    console.log(JSON.stringify(failedResult));
    process.exitCode = 1;
    return;
  }

  const google = new GoogleTranslationProvider(options);
  const result = await new TranslationGlossarySmokeTest(google).run();
  console.log(JSON.stringify(result));
  if (!result.success) process.exitCode = 1;
}

void main().catch(() => {
  console.log(JSON.stringify(failedResult));
  process.exitCode = 1;
});
