import { PrismaClient, Prisma } from "@prisma/client";
import { PasswordService } from "../src/auth/password.service";
const prisma = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(); const displayName = process.env.ADMIN_DISPLAY_NAME?.trim(); const password = process.env.ADMIN_PASSWORD;
  if (!email || !displayName || !password) throw new Error("Set ADMIN_EMAIL, ADMIN_DISPLAY_NAME, and ADMIN_PASSWORD");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters");
  const passwordHash = await new PasswordService().hash(password);
  const user = await prisma.user.upsert({ where: { normalizedEmail: email }, update: { displayName, passwordHash, role: "ADMIN", isActive: true, emailVerifiedAt: new Date() }, create: { email, normalizedEmail: email, displayName, passwordHash, role: "ADMIN", emailVerifiedAt: new Date() } });
  console.log(JSON.stringify({ success: true, userId: user.id, email: user.email, role: user.role }));
}
void main().catch((error: unknown) => { if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") throw new Error("Authentication tables are missing. Run npm run prisma:migrate, then use the web first-administrator setup. This CLI is an emergency fallback."); throw error; }).finally(() => prisma.$disconnect());
