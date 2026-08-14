import { Body, Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { TikTokService } from "./tiktok.service";
import {
  SafeTikTokAccountOverviewResponse,
  SyncTikTokAccountDto,
} from "./dto/tiktok-sync.dto";

@Controller("tiktok")
export class TikTokController {
  constructor(private readonly tiktokService: TikTokService) {}

  /**
   * Syncs authorized TikTok account and video metrics into PostgreSQL.
   */
  @Post("sync")
  @HttpCode(HttpStatus.OK)
  async syncAccount(
    @Body() dto: SyncTikTokAccountDto
  ): Promise<SafeTikTokAccountOverviewResponse> {
    return this.tiktokService.upsertTikTokAccount(dto);
  }

  /**
   * Retrieves the most recently connected / updated TikTok account overview.
   */
  @Get("latest")
  async getLatestAccount(): Promise<SafeTikTokAccountOverviewResponse | null> {
    return this.tiktokService.getLatestTikTokAccount();
  }

  /**
   * Lists all connected TikTok accounts.
   */
  @Get("accounts")
  async listAccounts() {
    return this.tiktokService.listTikTokAccounts();
  }
}
