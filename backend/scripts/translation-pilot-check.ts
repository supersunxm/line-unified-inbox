import { runTranslationPilotCheck } from "../src/translation/translation-pilot-check";
import { TranslationPilotPreflightError } from "../src/translation/translation-pilot-preflight";

try {
  const result = runTranslationPilotCheck(process.env, process.argv.slice(2));
  console.log(JSON.stringify(result));
  if (!result.ready) process.exitCode = 1;
} catch (error: unknown) {
  const errorCategory = error instanceof TranslationPilotPreflightError
    ? error.category
    : "INVALID_CONFIGURATION";
  console.log(JSON.stringify({ ready: false, errorCategory }));
  process.exitCode = 1;
}
