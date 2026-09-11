import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { CustomerSalesStatus } from "@prisma/client";
import { UpdateCustomerSalesInformationDto } from "./mobile-conversations.dto";

void test("FILM API validation requires a non-blank brand", async () => {
  const dto = plainToInstance(UpdateCustomerSalesInformationDto, {
    status: CustomerSalesStatus.FILM,
    filmBrand: "   ",
  });

  const errors = await validate(dto);
  assert.ok(errors.some((error) => error.property === "filmBrand"));
});

void test("non-FILM API payloads do not require a film brand", async () => {
  const dto = plainToInstance(UpdateCustomerSalesInformationDto, {
    status: CustomerSalesStatus.ONLINE,
  });

  assert.deepEqual(await validate(dto), []);
});
