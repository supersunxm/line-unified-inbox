import assert from "node:assert/strict";
import test from "node:test";
import { RequestMethod } from "@nestjs/common";
import { METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { BroadcastController } from "./broadcast.controller";

void test("Broadcast preview endpoint remains POST /broadcasts/preview", () => {
  const controllerPath = Reflect.getMetadata(PATH_METADATA, BroadcastController);
  const previewHandler = Object.getOwnPropertyDescriptor(
    BroadcastController.prototype,
    "preview",
  )?.value;

  assert.equal(controllerPath, "broadcasts");
  assert.ok(previewHandler);
  assert.equal(Reflect.getMetadata(PATH_METADATA, previewHandler), "preview");
  assert.equal(
    Reflect.getMetadata(METHOD_METADATA, previewHandler),
    RequestMethod.POST,
  );
});
