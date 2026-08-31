import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { LineChatNicknameWorkerModule } from "./line-chat-nickname-worker.module";
import { LineChatNicknameWorkerService } from "./line-chat-nickname-worker.service";

async function bootstrap() {
  const logger = new Logger("LineChatNicknameWorker");
  const app = await NestFactory.createApplicationContext(LineChatNicknameWorkerModule, {
    logger: ["error", "warn", "log"],
  });

  app.get(LineChatNicknameWorkerService);

  const shutdown = async (signal: string) => {
    logger.log(`Received ${signal}, shutting down gracefully...`);
    await app.close();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void bootstrap();
