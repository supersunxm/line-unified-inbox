import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ConversationQueryDto, ConversationSummaryQueryDto } from "./dto";

for (const Dto of [ConversationQueryDto, ConversationSummaryQueryDto] as const) {
  void test(`${Dto.name} accepts valid month query values`, async () => {
    for (const month of ["2026-09", "2026-10", "all"]) {
      const errors = await validate(plainToInstance(Dto, { month }));
      assert.equal(errors.some((error) => error.property === "month"), false);
    }
  });

  void test(`${Dto.name} rejects malformed month query values`, async () => {
    for (const month of ["October 2026", "2026-13", "2026-1"]) {
      const errors = await validate(plainToInstance(Dto, { month }));
      assert.equal(errors.some((error) => error.property === "month"), true);
    }
  });
}
