import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { validateProductionEnvironment } from "./config/production-environment";
import { hostname } from "node:os";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MobileApiExceptionFilter } from "./mobile/mobile-api-exception.filter";

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
  const allowedOrigins = [
    frontendUrl,
    // Google Maps content script fetches batch-runner endpoints from this origin.
    // The routes still require a valid Bearer token issued by the dashboard.
    "https://www.google.com",
    "https://www.google.co.th",
  ];
  app.enableCors({ origin: allowedOrigins, credentials: true, exposedHeaders: ["Content-Disposition", "X-Export-Row-Count"] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  app.useGlobalFilters(new MobileApiExceptionFilter());
  const port = Number(process.env.PORT || "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port number");
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
