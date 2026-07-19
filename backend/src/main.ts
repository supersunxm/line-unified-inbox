import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { validateProductionEnvironment } from "./config/production-environment";

async function bootstrap() {
  validateProductionEnvironment();
  // rawBody preserves the exact bytes required by LINE's HMAC signature check.
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";
  app.enableCors({ origin: frontendUrl, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );
  const port = Number(process.env.PORT || "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port number");
  await app.listen(port, "0.0.0.0");
}

void bootstrap();
