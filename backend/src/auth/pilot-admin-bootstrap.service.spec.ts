import assert from "node:assert/strict";
import test from "node:test";
import { Logger } from "@nestjs/common";
import { PrismaService } from "../prisma.service";
import { EmailService } from "../email/email.service";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";
import { PilotAdminBootstrapService } from "./pilot-admin-bootstrap.service";
import { SetupService } from "./setup.service";

const pilotEnvironment = {
  NODE_ENV: "production",
  PILOT_MODE: "true",
  PILOT_ADMIN_BOOTSTRAP_ENABLED: "true",
  PILOT_ADMIN_USERNAME: " PilotAdmin ",
  PILOT_ADMIN_PASSWORD: "Strong pilot passphrase 2026",
  PILOT_ADMIN_DISPLAY_NAME: "Pilot Operator",
};

async function withEnvironment(
  values: Record<string, string | undefined>,
  action: () => Promise<void>,
) {
  const names = Object.keys(values);
  const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  try {
    await action();
  } finally {
    for (const name of names) {
      const value = previous[name];
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

type StoredUser = {
  id: string;
  username: string | null;
  email: string;
  normalizedEmail: string;
  displayName: string;
  passwordHash: string;
  role: "ADMIN" | "VIEWER";
  isActive: boolean;
  emailVerifiedAt: Date | null;
};

function createPrisma(initialUsers: StoredUser[] = []) {
  const users = initialUsers.map((user) => ({ ...user }));
  const userApi = {
    findUnique: ({ where }: { where: { username?: string; normalizedEmail?: string } }) =>
      Promise.resolve(users.find((user) =>
        where.username !== undefined
          ? user.username === where.username
          : user.normalizedEmail === where.normalizedEmail,
      ) ?? null),
    findFirst: ({ where }: { where: { OR: Array<{ normalizedEmail?: string; username?: string }> } }) =>
      Promise.resolve(users.find((user) => where.OR.some((condition) =>
        condition.normalizedEmail === user.normalizedEmail ||
        condition.username === user.username,
      )) ?? null),
    create: ({ data }: { data: Omit<StoredUser, "id"> }) => {
      const user = { id: `user-${users.length + 1}`, ...data };
      users.push(user);
      return Promise.resolve(user);
    },
    update: ({ where, data }: { where: { id: string }; data: Partial<StoredUser> & { lastLoginAt?: Date } }) => {
      const user = users.find((item) => item.id === where.id);
      if (!user) throw new Error("Test user not found");
      Object.assign(user, data);
      return Promise.resolve(user);
    },
    count: ({ where }: { where: { role: "ADMIN"; isActive: boolean } }) =>
      Promise.resolve(users.filter((user) => user.role === where.role && user.isActive === where.isActive).length),
  };
  const prisma = {
    user: userApi,
    session: {
      create: ({ data }: { data: unknown }) => Promise.resolve(data),
    },
    $transaction: (operations: Array<Promise<unknown>>) => Promise.all(operations),
  } as unknown as PrismaService;
  return { prisma, users };
}

const fakePasswords = {
  hash: () => Promise.resolve("safely-hashed-value"),
} as unknown as PasswordService;

void test("disabled bootstrap does nothing", async () => {
  await withEnvironment(
    { ...pilotEnvironment, PILOT_ADMIN_BOOTSTRAP_ENABLED: "false" },
    async () => {
      await new PilotAdminBootstrapService({} as PrismaService, fakePasswords)
        .onApplicationBootstrap();
    },
  );
});

void test("production without PILOT_MODE does nothing", async () => {
  await withEnvironment({ ...pilotEnvironment, PILOT_MODE: "false" }, async () => {
    await new PilotAdminBootstrapService({} as PrismaService, fakePasswords)
      .onApplicationBootstrap();
  });
});

void test("valid configuration creates a normalized verified admin", async () => {
  const { prisma, users } = createPrisma();
  await withEnvironment(pilotEnvironment, async () => {
    await new PilotAdminBootstrapService(prisma, fakePasswords).onApplicationBootstrap();
  });
  assert.equal(users.length, 1);
  assert.equal(users[0].username, "pilotadmin");
  assert.equal(users[0].email, "pilot-admin@internal.invalid");
  assert.equal(users[0].role, "ADMIN");
  assert.equal(users[0].isActive, true);
  assert.ok(users[0].emailVerifiedAt instanceof Date);
});

void test("existing pilot admin is updated without changing unrelated administrators", async () => {
  const existing: StoredUser = { id: "pilot", username: "pilotadmin", email: "pilot-admin@internal.invalid", normalizedEmail: "pilot-admin@internal.invalid", displayName: "Old", passwordHash: "old", role: "VIEWER", isActive: false, emailVerifiedAt: null };
  const unrelated: StoredUser = { id: "other", username: "other-admin", email: "other@example.com", normalizedEmail: "other@example.com", displayName: "Other", passwordHash: "unchanged", role: "ADMIN", isActive: true, emailVerifiedAt: new Date(0) };
  const { prisma, users } = createPrisma([existing, unrelated]);
  await withEnvironment(pilotEnvironment, async () => {
    await new PilotAdminBootstrapService(prisma, fakePasswords).onApplicationBootstrap();
  });
  assert.deepEqual(users.find(({ id }) => id === "other"), unrelated);
  const updated = users.find(({ id }) => id === "pilot");
  assert.equal(updated?.passwordHash, "safely-hashed-value");
  assert.equal(updated?.role, "ADMIN");
  assert.equal(updated?.isActive, true);
  assert.ok(updated?.emailVerifiedAt instanceof Date);
});

void test("weak and missing bootstrap variables fail clearly", async () => {
  await withEnvironment({ ...pilotEnvironment, PILOT_ADMIN_PASSWORD: "password123" }, async () => {
    await assert.rejects(
      () => new PilotAdminBootstrapService({} as PrismaService, fakePasswords).onApplicationBootstrap(),
      /at least 12 characters|common password/,
    );
  });
  await withEnvironment({ ...pilotEnvironment, PILOT_ADMIN_USERNAME: undefined }, async () => {
    await assert.rejects(
      () => new PilotAdminBootstrapService({} as PrismaService, fakePasswords).onApplicationBootstrap(),
      /PILOT_ADMIN_USERNAME is required/,
    );
  });
  await withEnvironment({ ...pilotEnvironment, PILOT_ADMIN_PASSWORD: undefined }, async () => {
    await assert.rejects(
      () => new PilotAdminBootstrapService({} as PrismaService, fakePasswords).onApplicationBootstrap(),
      /PILOT_ADMIN_PASSWORD is required/,
    );
  });
});

void test("bootstrap logs never contain the password", async () => {
  const messages: string[] = [];
  const { prisma } = createPrisma();
  const service = new PilotAdminBootstrapService(prisma, fakePasswords);
  const serviceWithLogger = service as unknown as { logger: Pick<Logger, "log"> };
  serviceWithLogger.logger.log = (message: unknown) => messages.push(String(message));
  await withEnvironment(pilotEnvironment, async () => {
    await service.onApplicationBootstrap();
  });
  assert.ok(messages.some((message) => message.includes("pilot_admin_bootstrap_created")));
  assert.ok(messages.every((message) => !message.includes(pilotEnvironment.PILOT_ADMIN_PASSWORD)));
});

void test("bootstrapped admin closes setup and can log in by username", async () => {
  const { prisma } = createPrisma();
  const passwords = new PasswordService();
  await withEnvironment(pilotEnvironment, async () => {
    await new PilotAdminBootstrapService(prisma, passwords).onApplicationBootstrap();
  });
  const email = { configured: () => false, mode: () => "none" } as EmailService;
  const auth = new AuthService(prisma, passwords);
  const setup = new SetupService(prisma, email, passwords, auth);
  assert.deepEqual(await setup.status(), {
    firstAdminRequired: false,
    registrationAvailable: false,
    emailProviderConfigured: false,
    emailProviderMode: "none",
  });
  const result = await auth.login("PILOTADMIN", pilotEnvironment.PILOT_ADMIN_PASSWORD);
  assert.equal(result.user.role, "ADMIN");
  assert.equal(result.user.isActive, true);
});
