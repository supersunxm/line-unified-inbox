import assert from "node:assert/strict";
import test from "node:test";
import { MobileConfigService } from "./mobile-config.service";

void test("mobile config returns version and maintenance state without secrets", () => {
  const result = new MobileConfigService().get({ MOBILE_MIN_APP_VERSION: "2.1.0", MOBILE_MAINTENANCE_ENABLED: "true", MOBILE_MAINTENANCE_MESSAGE: "Scheduled maintenance" });
  assert.deepEqual(result, { minimumAppVersion: "2.1.0", maintenance: { enabled: true, message: "Scheduled maintenance" } });
});
