import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { ALLOW_SCOPED_NON_REPLY_ACTION, REQUIRED_ROLES } from "../auth/auth.decorators";
import { TranslationController } from "./translation.controller";

test("translation feedback is a scoped POST action for authorized website roles", () => {
  const handler = TranslationController.prototype.submitFeedback;
  assert.equal(Reflect.getMetadata(PATH_METADATA, TranslationController), "messages");
  assert.equal(Reflect.getMetadata(PATH_METADATA, handler), ":messageId/translations/feedback");
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), RequestMethod.POST);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, handler), ["ADMIN", "ASSISTANT", "VIEWER"]);
  assert.equal(Reflect.getMetadata(ALLOW_SCOPED_NON_REPLY_ACTION, handler), true);
});
