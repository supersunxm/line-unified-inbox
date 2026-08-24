import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import { EmailService } from "./email.service";

function createService(provider: { send: (message: unknown) => Promise<void> }) {
  const deliveries: unknown[] = [];
  const prisma = { emailDeliveryEvent: { create: async ({ data }: { data: unknown }) => { deliveries.push(data); } } } as any;
  return { service: new EmailService(prisma, provider), deliveries };
}

async function withEnvironment(values: Record<string, string | undefined>, action: () => Promise<void>) {
  const previous = Object.fromEntries(Object.keys(values).map((name) => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try { await action(); } finally {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

void test("approval email uses the provider abstraction and records a successful delivery", async () => {
  const sent: unknown[] = [];
  const { service, deliveries } = createService({ send: async (message) => { sent.push(message); } });
  await withEnvironment({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: "resend-secret", EMAIL_FROM_ADDRESS: "no-reply@lineoppo.click" }, async () => {
    await service.sendAccountApproved({ to: "pc@example.test", displayName: "Ploy", storeName: "Central World", role: "STAFF" });
  });
  assert.equal(sent.length, 1);
  assert.deepEqual((deliveries[0] as any).purpose, "ACCOUNT_APPROVED");
  assert.equal((deliveries[0] as any).success, true);
});

void test("missing Resend configuration fails safely and records a failed delivery without returning credentials", async () => {
  const { service, deliveries } = createService({ send: async () => { throw new Error("must not be called"); } });
  await withEnvironment({ EMAIL_PROVIDER: "resend", RESEND_API_KEY: undefined, EMAIL_FROM_ADDRESS: "no-reply@lineoppo.click" }, async () => {
    await assert.rejects(() => service.sendAccountApproved({ to: "pc@example.test", displayName: "Ploy", storeName: "Central World", role: "STAFF" }), ServiceUnavailableException);
  });
  assert.equal((deliveries[0] as any).purpose, "ACCOUNT_APPROVED");
  assert.equal((deliveries[0] as any).success, false);
  assert.doesNotMatch(JSON.stringify(deliveries), /resend-secret|RESEND_API_KEY/i);
});
