import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as path from "node:path";

test("LINE Chat worker Docker Playwright image matches locked package version", () => {
  const backendDir = process.cwd();
  const lock = JSON.parse(readFileSync(path.join(backendDir, "package-lock.json"), "utf8"));
  const dockerfile = readFileSync(path.join(backendDir, "Dockerfile.line-chat-worker"), "utf8");

  const lockedVersion = lock.packages?.["node_modules/playwright"]?.version;
  assert.equal(typeof lockedVersion, "string");
  assert.match(
    dockerfile,
    new RegExp(`mcr\\.microsoft\\.com/playwright:v${lockedVersion}-noble`),
    `Docker Playwright image must match package-lock Playwright version ${lockedVersion}`,
  );
});
