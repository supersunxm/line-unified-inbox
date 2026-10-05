#!/usr/bin/env node
// Runs `tsc --noEmit`, counts the errors and fails when the count is above the baseline in
// tsc-baseline.json. The build does not type-check (next.config.ts ignoreBuildErrors), so
// this is what stops type errors from growing. Lower the baseline when you fix errors;
// never raise it.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const baseline = JSON.parse(readFileSync(join(root, "tsc-baseline.json"), "utf8")).errors;
if (!Number.isInteger(baseline) || baseline < 0) {
  console.error("tsc-baseline.json must contain a non-negative integer \"errors\".");
  process.exit(2);
}

const tscBin = join(root, "node_modules", "typescript", "bin", "tsc");
const result = spawnSync(process.execPath, [tscBin, "--noEmit", "--pretty", "false"], { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (result.error) {
  console.error(`Could not run tsc: ${result.error.message}`);
  process.exit(2);
}
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
const errors = output.split("\n").filter((line) => /error TS\d+:/.test(line));

console.log(`tsc errors: ${errors.length} (baseline ${baseline})`);
if (errors.length > baseline) {
  console.error(`Type errors rose above the baseline by ${errors.length - baseline}. Fix the new errors; do not raise the baseline.`);
  console.error(errors.join("\n"));
  process.exit(1);
}
if (errors.length < baseline) {
  console.log(`Below the baseline: lower "errors" in tsc-baseline.json to ${errors.length}.`);
}
