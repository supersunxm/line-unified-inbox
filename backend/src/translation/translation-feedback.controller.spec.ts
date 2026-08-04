import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { REQUIRED_ROLES } from "../auth/auth.decorators";
import { TranslationController } from "./translation.controller";

test("translation feedback endpoint is a separate ADMIN-only POST route", () => {
  const handler = TranslationController.prototype.submitFeedback;
  assert.equal(Reflect.getMetadata(PATH_METADATA, TranslationController), "messages");
  assert.equal(Reflect.getMetadata(PATH_METADATA, handler), ":messageId/translations/feedback");
  assert.equal(Reflect.getMetadata(METHOD_METADATA, handler), RequestMethod.POST);
  assert.deepEqual(Reflect.getMetadata(REQUIRED_ROLES, handler), ["ADMIN"]);
});
