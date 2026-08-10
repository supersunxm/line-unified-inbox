import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { validateProductionEnvironment } from "./config/production-environment";
import { hostname } from "node:os";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

async function bootstrap() {
  validateProductionEnvironment();
  const packageJson = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8")) as { version?: string };
  console.log("[APP FINGERPRINT]", {
    hostname: process.env.RAILWAY_REPLICA_ID || hostname(),
    pid: process.pid,
    commit: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.SOURCE_COMMIT || "unknown",
    buildTime: process.env.BUILD_TIME || "unknown",
    version: packageJson.version || "unknown",
  });
  // rawBody preserves the exact bytes required by LINE's HMAC signature check.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  app.enableCors({ origin: frontendUrl, credentials: true, exposedHeaders: ["Content-Disposition", "X-Export-Row-Count"] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  const port = Number(process.env.PORT || "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port number");
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
