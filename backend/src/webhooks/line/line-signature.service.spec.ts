import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { LineSignatureService } from "./line-signature.service";

const service = new LineSignatureService();
const secret = "unit-test-secret";
const body = Buffer.from('{"events":[]}');
const signature = createHmac("sha256", secret).update(body).digest("base64");
const wrongSecret = "wrong-oa-secret";

void test("valid LINE signature succeeds", () => assert.equal(service.verify(body, signature, secret), true));
void test("invalid LINE signature fails", () => assert.equal(service.verify(body, Buffer.from("wrong").toString("base64"), secret), false));
void test("missing LINE signature fails", () => assert.equal(service.verify(body, "", secret), false));
void test("changed body fails verification", () => assert.equal(service.verify(Buffer.from('{"events":[1]}'), signature, secret), false));
void test("whitespace changes fail when the raw bytes change", () => assert.equal(service.verify(Buffer.from('{ "events": [] }'), signature, secret), false));
void test("empty events payload with its exact valid signature succeeds", () => assert.equal(service.verify(body, signature, secret), true));
void test("wrong OA secret fails", () => assert.equal(service.verify(body, signature, wrongSecret), false));
void test("correct OA secret succeeds", () => assert.equal(service.verify(body, signature, secret), true));
