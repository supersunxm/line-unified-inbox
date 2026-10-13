import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { StoreMasterService } from "./store-master.service";
import { StoreMasterController } from "./store-master.controller";

void test("ADMIN sync controller defaults to preview and does not authorize apply", async () => {
  const requests: unknown[] = [];
  const service = {
    syncFromGoogleSheet: async (snapshot: unknown, options: unknown) => {
      requests.push({ snapshot, options });
      return { mode: "PREVIEW" };
    },
  };
  const controller = new StoreMasterController(service as unknown as StoreMasterService);

  await controller.sync();
  assert.deepEqual(requests, [{
    snapshot: undefined,
    options: { apply: false, expectedSha256: undefined, approvedChangeSet: [] },
  }]);
});

void test("ADMIN sync controller rejects unsupported or malformed approval payloads", () => {
  const service = { syncFromGoogleSheet: async () => ({ mode: "PREVIEW" }) };
  const controller = new StoreMasterController(service as unknown as StoreMasterService);

  assert.throws(() => controller.sync({ force: true }), BadRequestException);
  assert.throws(() => controller.sync({ apply: true, approvedChangeSet: [{ kind: "STORE_LIFECYCLE" }] }), BadRequestException);
});
