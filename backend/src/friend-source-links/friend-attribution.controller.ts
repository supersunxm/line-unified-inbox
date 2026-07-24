import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from "@nestjs/common";
import { Public } from "../auth/auth.decorators";
import { IdentifyFriendAttributionDto, UpdateFriendshipStatusDto } from "./friend-attribution.dto";
import { FriendAttributionRateLimitGuard } from "./friend-attribution-rate-limit.guard";
import { FriendSourceLinksService } from "./friend-source-links.service";

@Controller("friend-attribution")
@UseGuards(FriendAttributionRateLimitGuard)
export class FriendAttributionController {
  constructor(private readonly service: FriendSourceLinksService) {}

  @Post("identify")
  @Public()
  @HttpCode(HttpStatus.OK)
  async identify(@Body() dto: IdentifyFriendAttributionDto) {
    return this.service.identifySession(dto);
  }

  @Post("friendship-status")
  @Public()
  @HttpCode(HttpStatus.OK)
  async updateFriendshipStatus(@Body() dto: UpdateFriendshipStatusDto) {
    return this.service.updateFriendshipStatus(dto);
  }

  @Get("session-status")
  @Public()
  async getSessionStatus(@Query("token") token: string) {
    return this.service.getSessionStatus(token);
  }
}
