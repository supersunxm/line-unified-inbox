import assert from "node:assert/strict";
import test from "node:test";
import { BadRequestException } from "@nestjs/common";
import { normalizeThaiMobilePhone } from "./phone-normalization";

void test("normalizes supported Thai mobile formats", () => {
  for (const value of ["0812345678", "66812345678", "+66812345678"]) assert.equal(normalizeThaiMobilePhone(value), "+66812345678");
});

void test("rejects invalid mobile numbers", () => {
  assert.throws(() => normalizeThaiMobilePhone("081234567"), BadRequestException);
});
