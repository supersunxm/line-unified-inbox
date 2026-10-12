const { execFileSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const { PrismaClient } = require("@prisma/client");

const adminDatabaseUrl = process.env.DATABASE_URL?.trim();
if (!adminDatabaseUrl) throw new Error("DATABASE_URL is required for the isolated Store Master CI test");

const adminUrl = new URL(adminDatabaseUrl);
const adminDatabaseName = decodeURIComponent(adminUrl.pathname.slice(1));
if (
  (adminUrl.protocol !== "postgresql:" && adminUrl.protocol !== "postgres:") ||
  !["localhost", "127.0.0.1", "::1", "[::1]", "postgres"].includes(adminUrl.hostname) ||
  adminUrl.username !== "ci" ||
  adminDatabaseName !== "ci"
) {
  throw new Error("Store Master PostgreSQL tests require the local CI database; no database was changed");
}

const databaseName = `store_master_ci_${process.pid}`;
const testUrl = new URL(adminUrl);
testUrl.pathname = `/${databaseName}`;
const testDatabaseUrl = testUrl.toString();
const admin = new PrismaClient({ datasources: { db: { url: adminDatabaseUrl } } });
let databaseCreated = false;

async function main() {
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    databaseCreated = true;
    const env = {
      ...process.env,
      DATABASE_URL: testDatabaseUrl,
      STORE_MASTER_TEST_DATABASE_URL: testDatabaseUrl,
    };
    execFileSync("npx", ["prisma", "migrate", "deploy"], { env, stdio: "inherit" });
    const storeMasterTestFiles = readdirSync("src/store-master")
      .filter((file) => file.endsWith(".spec.ts"))
      .sort()
      .map((file) => `src/store-master/${file}`);
    execFileSync("npx", ["tsx", "--test", "--test-concurrency=1", ...storeMasterTestFiles], {
      env,
      stdio: "inherit",
    });
  } finally {
    try {
      if (databaseCreated) {
        await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
        process.stdout.write("STORE_MASTER_TEST_DATABASE_CLEANUP=PASS\n");
      }
    } finally {
      await admin.$disconnect();
    }
  }
}

main().catch((error) => {
  const code = typeof error?.code === "string" ? error.code : "unknown";
  process.stderr.write(`Store Master PostgreSQL CI verification failed (code ${code}); isolated cleanup was attempted.\n`);
  process.exitCode = 1;
});
