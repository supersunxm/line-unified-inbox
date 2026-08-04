import { runTranslationPilotPreflight, TranslationPilotPreflightError } from "../src/translation/translation-pilot-preflight";

try {
  const result = runTranslationPilotPreflight(process.env, process.argv.slice(2));
  console.log(JSON.stringify(result));
  if (!result.ready) process.exitCode = 1;
} catch (error: unknown) {
  const category = error instanceof TranslationPilotPreflightError ? error.category : "INVALID_CONFIGURATION";
  console.log(JSON.stringify({ ready: false, errorCategory: category }));
  process.exitCode = 1;
}
