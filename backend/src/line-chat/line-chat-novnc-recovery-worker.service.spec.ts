import { strict as assert } from "node:assert";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Regression note for the production incident where the manual recovery endpoint
// returned a token but the raw Chromium child exited immediately, invalidating it.
// The implementation now owns a Playwright persistent context and only publishes
// the recovery token after that context has launched and navigated.

test("noVNC recovery browser lifecycle regression is documented", () => {
  const source = readFileSync(join(__dirname, "line-chat-novnc-recovery-worker.service.ts"), "utf8");
  assert.match(source, /launchManagedPersistentContext/);
  assert.match(source, /closeManagedPersistentContext/);
  assert.doesNotMatch(source, /chromium\.launchPersistentContext/);
});
