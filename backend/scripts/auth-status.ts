import { PrismaClient, Prisma } from "@prisma/client";
const prisma = new PrismaClient();
async function main() {
  try {
    const activeAdminExists = (await prisma.user.count({ where: { role: "ADMIN", isActive: true } })) > 0;
    const mode = process.env.EMAIL_PROVIDER?.trim().toLowerCase() || "none";
    const emailProviderConfigured = mode === "console" ? process.env.NODE_ENV !== "production" : mode === "resend" && Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
    console.log(JSON.stringify({ migrationReady: true, userTableReady: true, activeAdminExists, emailProviderConfigured }));
  } catch (error) {
    const tableMissing = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021";
    console.log(JSON.stringify({ migrationReady: false, userTableReady: !tableMissing, activeAdminExists: false, emailProviderConfigured: false }));
    process.exitCode = 1;
  }
}
void main().finally(() => prisma.$disconnect());
