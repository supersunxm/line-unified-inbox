import { OPPO_PROTECTED_SOURCE_TERMS } from "./glossary/oppo-translation-glossary";
import { TRANSLATION_GLOSSARY_SMOKE_TEXT } from "./glossary/translation-glossary-smoke-test";
import { runTranslationPilotCheck } from "./translation-pilot-check";

export type TranslationPilotReleaseCheckDependencies = {
  healthReady: () => Promise<boolean>;
  currentMigrationNames: () => Promise<readonly string[]>;
  appliedMigrationNames: () => Promise<readonly string[]>;
  glossaryAvailable?: () => boolean;
};

export type TranslationPilotReleaseCheckResult = {
  releaseReady: boolean;
  checks: {
    configuration: boolean;
    runtime: boolean;
    database: boolean;
    glossary: boolean;
  };
};

export function isGlossarySmokeValidationAvailable(): boolean {
  return OPPO_PROTECTED_SOURCE_TERMS.length === 7
    && new Set(OPPO_PROTECTED_SOURCE_TERMS).size === 7
    && OPPO_PROTECTED_SOURCE_TERMS.every((term) => TRANSLATION_GLOSSARY_SMOKE_TEXT.includes(term));
}

export async function runTranslationPilotReleaseCheck(
  environment: NodeJS.ProcessEnv,
  arguments_: readonly string[],
  dependencies: TranslationPilotReleaseCheckDependencies,
): Promise<TranslationPilotReleaseCheckResult> {
  const pilot = runTranslationPilotCheck(environment, arguments_);
  const [healthReady, currentMigrationNames, appliedMigrationNames] = await Promise.all([
    dependencies.healthReady(),
    dependencies.currentMigrationNames(),
    dependencies.appliedMigrationNames(),
  ]);
  const applied = new Set(appliedMigrationNames);
  const database = healthReady
    && currentMigrationNames.length > 0
    && currentMigrationNames.every((migration) => applied.has(migration));
  const checks = {
    configuration: pilot.checks.configuration && pilot.checks.provider,
    runtime: healthReady && pilot.checks.runtime && pilot.checks.metrics,
    database,
    glossary: (dependencies.glossaryAvailable ?? isGlossarySmokeValidationAvailable)(),
  };
  return { releaseReady: Object.values(checks).every(Boolean), checks };
}
