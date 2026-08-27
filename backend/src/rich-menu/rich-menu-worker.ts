import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { AppModule } from "../app.module";
import { RichMenuPublishWorkerService } from "./rich-menu-publish-worker.service";

async function bootstrap() {
  const logger = new Logger("RichMenuStandaloneWorker");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn", "log"],
  });

  const worker = app.get(RichMenuPublishWorkerService);
  logger.log("Rich Menu Publish background worker started successfully");

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void bootstrap();
