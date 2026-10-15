import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatSearchController } from "./chat-search.controller";
import { ChatSearchService } from "./chat-search.service";

@Module({
  imports: [AuthModule],
  controllers: [ChatSearchController],
  providers: [ChatSearchService],
})
export class ChatSearchModule {}
