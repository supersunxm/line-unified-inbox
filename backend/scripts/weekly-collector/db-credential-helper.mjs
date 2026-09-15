import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Safely resolves the production database URL without printing or exposing secrets.
 * Order of resolution:
 * 1. Process environment (if explicitly injected by caller)
 * 2. macOS Keychain (service: "oppo-production-database", account: "line-unified-inbox")
 * 3. Secure local configuration file (backend/local-data/production-db.env, chmod 600)
 * 4. Railway CLI fallback if authenticated
 */
export function resolveProductionDatabaseUrl() {
  if (process.env.PRODUCTION_DATABASE_URL && process.env.PRODUCTION_DATABASE_URL.startsWith("postgres")) {
    return process.env.PRODUCTION_DATABASE_URL.trim();
  }

  // 1. Attempt macOS Keychain
  try {
    const keychainUrl = execSync(
      'security find-generic-password -s "oppo-production-database" -a "line-unified-inbox" -w',
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }
    ).trim();
    if (keychainUrl.startsWith("postgres") && !keychainUrl.includes("localhost") && !keychainUrl.includes("127.0.0.1")) {
      return keychainUrl;
    }
  } catch {
    // Keychain lookup ignored if not found or locked
  }

  // 2. Attempt secure local-data config file
  const localEnvPath = path.resolve(__dirname, "../../local-data/production-db.env");
  if (fs.existsSync(localEnvPath)) {
    try {
      const content = fs.readFileSync(localEnvPath, "utf8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("DATABASE_URL=")) {
          let url = trimmed.slice("DATABASE_URL=".length).trim();
          if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
            url = url.slice(1, -1);
          }
          if (url.startsWith("postgres") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
            return url;
          }
        }
      }
    } catch {
      // Ignored
    }
  }

  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith("postgres") && !process.env.DATABASE_URL.includes("localhost") && !process.env.DATABASE_URL.includes("127.0.0.1") && !process.env.DATABASE_URL.includes(".railway.internal")) {
    return process.env.DATABASE_URL.trim();
  }

  // 3. Railway CLI fallback
  try {
    const kvOutput = execSync("railway variables -s Postgres --kv", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    for (const line of kvOutput.split("\n")) {
      if (line.startsWith("DATABASE_PUBLIC_URL=")) {
        const url = line.substring("DATABASE_PUBLIC_URL=".length).trim();
        if (url.startsWith("postgres")) {
          return url;
        }
      }
    }
  } catch {
    // Ignored
  }

  throw new Error("Could not securely resolve production DATABASE_URL from Keychain, local-data/production-db.env, or Railway CLI.");
}

/**
 * Returns a masked version of a database URL for safe logging.
 * NEVER prints credentials.
 */
export function maskDatabaseUrl(url) {
  if (!url || typeof url !== "string") return "[REDACTED]";
  try {
    const parsed = new URL(url);
    const user = parsed.username ? "***" : "";
    const pass = parsed.password ? ":***" : "";
    const auth = user || pass ? `${user}${pass}@` : "";
    return `${parsed.protocol}//${auth}${parsed.host}${parsed.pathname}`;
  } catch {
    return "[MASKED_DATABASE_URL]";
  }
}

/**
 * Instantiates a PrismaClient configured with the securely resolved database URL.
 */
export function getProductionPrismaClient() {
  const url = resolveProductionDatabaseUrl();
  return new PrismaClient({
    datasources: {
      db: { url },
    },
  });
}
