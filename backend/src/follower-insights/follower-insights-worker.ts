import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FollowerInsightsWorkerModule } from "./follower-insights-worker.module";

async function bootstrap() {
  const logger = new Logger("FollowerInsightsStandaloneWorker");
  const app = await NestFactory.createApplicationContext(FollowerInsightsWorkerModule, {
    logger: ["error", "warn", "log"],
  });

  logger.log("Follower Insights backfill worker started successfully");

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void bootstrap();
