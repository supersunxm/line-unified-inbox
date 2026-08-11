import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "@nestjs/common";
import { MODULE_METADATA, SELF_DECLARED_DEPS_METADATA } from "@nestjs/common/constants";
import { NestFactory } from "@nestjs/core";

import { AuthModule } from "./auth.module";
import { OTP_CODE_GENERATOR, OtpChallengeService } from "./otp-challenge.service";

@Module({
  providers: [
    {
      provide: OTP_CODE_GENERATOR,
      useValue: () => "123456",
    },
    OtpChallengeService,
  ],
})
class OtpChallengeTestModule {}

type InjectedDependency = {
  index: number;
  param: unknown;
};

type ValueProvider = {
  provide: unknown;
  useValue: unknown;
};

function isValueProvider(value: unknown): value is ValueProvider {
  return typeof value === "object" && value !== null && "provide" in value && "useValue" in value;
}

void test("OtpChallengeService injects a registered OTP generator token", () => {
  const dependencies = Reflect.getMetadata(
    SELF_DECLARED_DEPS_METADATA,
    OtpChallengeService,
  ) as InjectedDependency[];

  assert.deepEqual(dependencies, [{ index: 0, param: OTP_CODE_GENERATOR }]);

  const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, AuthModule) as unknown[];
  const generator = providers.find(
    (provider): provider is ValueProvider =>
      isValueProvider(provider) && provider.provide === OTP_CODE_GENERATOR,
  );

  assert.equal(typeof generator?.useValue, "function");
});

void test("Nest instantiates OtpChallengeService with the explicit generator token", async () => {
  const application = await NestFactory.createApplicationContext(OtpChallengeTestModule, {
    logger: false,
  });

  assert.ok(application.get(OtpChallengeService));

  await application.close();
});
