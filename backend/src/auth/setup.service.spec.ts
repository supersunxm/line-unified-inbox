import assert from "node:assert/strict";
import test from "node:test";
import { PrismaService } from "../prisma.service";
import { EmailService } from "../email/email.service";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { SetupService } from "./setup.service";

function service(activeAdmins: number, configured = true, mode = "console") {
  const prisma = { user: { count: () => Promise.resolve(activeAdmins) } } as unknown as PrismaService;
  const email = { configured: () => configured, mode: () => mode } as unknown as EmailService;
  return new SetupService(prisma, email, new PasswordService(), {} as AuthService);
}

void test("setup status requires first admin when zero active admins exist", async () => {
  assert.deepEqual(await service(0).status(), { firstAdminRequired: true, registrationAvailable: true, emailProviderConfigured: true, emailProviderMode: "console" });
});

void test("setup status closes registration after an active admin exists", async () => {
  assert.deepEqual(await service(1, true, "resend").status(), { firstAdminRequired: false, registrationAvailable: false, emailProviderConfigured: true, emailProviderMode: "resend" });
});
