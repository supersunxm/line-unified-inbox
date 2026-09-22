import assert from "node:assert/strict";
import test from "node:test";

test("weekly collector accepts Railway private DATABASE_URL inside Railway runtime", async () => {
  const previous = {
    databaseUrl: process.env.DATABASE_URL,
    railwayEnvironmentId: process.env.RAILWAY_ENVIRONMENT_ID,
    productionDatabaseUrl: process.env.PRODUCTION_DATABASE_URL,
  };

  process.env.DATABASE_URL = "postgresql://user:pass@postgres.railway.internal:5432/railway";
  process.env.RAILWAY_ENVIRONMENT_ID = "production";
  delete process.env.PRODUCTION_DATABASE_URL;

  try {
    // @ts-expect-error JavaScript helper intentionally lives with the collector scripts.
    const helper = await import("../scripts/weekly-collector/db-credential-helper.mjs");
    assert.equal(
      helper.resolveProductionDatabaseUrl(),
      "postgresql://user:pass@postgres.railway.internal:5432/railway",
    );
  } finally {
    if (previous.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.databaseUrl;

    if (previous.railwayEnvironmentId === undefined) delete process.env.RAILWAY_ENVIRONMENT_ID;
    else process.env.RAILWAY_ENVIRONMENT_ID = previous.railwayEnvironmentId;

    if (previous.productionDatabaseUrl === undefined) delete process.env.PRODUCTION_DATABASE_URL;
    else process.env.PRODUCTION_DATABASE_URL = previous.productionDatabaseUrl;
  }
});
