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

void test("ONLINE API validation requires a non-blank source", async () => {
  const dto = plainToInstance(UpdateCustomerSalesInformationDto, {
    status: CustomerSalesStatus.ONLINE,
  });

  const errors = await validate(dto);
  assert.ok(errors.some((error) => error.property === "onlineSource"));

  const blankDto = plainToInstance(UpdateCustomerSalesInformationDto, {
    status: CustomerSalesStatus.ONLINE,
    onlineSource: "   ",
  });
  const blankErrors = await validate(blankDto);
  assert.ok(blankErrors.some((error) => error.property === "onlineSource"));
});

void test("ONLINE API validation accepts a predefined source", async () => {
  const dto = plainToInstance(UpdateCustomerSalesInformationDto, {
    status: CustomerSalesStatus.ONLINE,
    onlineSource: "TikTok",
  });

  assert.deepEqual(await validate(dto), []);
});
