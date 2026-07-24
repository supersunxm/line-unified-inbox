import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from "@nestjs/common";
import { Roles } from "../auth/auth.decorators";
import { UpsertFriendAttributionConfigDto } from "./friend-attribution.dto";
import { GenerateFriendSourceLinksDto, QueryFriendSourceLinksDto, UpdateFriendSourceLinkDto } from "./friend-source-links.dto";
import { FriendSourceLinksService } from "./friend-source-links.service";

@Controller("friend-source-links")
export class FriendSourceLinksController {
  constructor(private readonly service: FriendSourceLinksService) {}

  @Post("generate")
  @Roles("ADMIN")
  async generate(@Body() dto: GenerateFriendSourceLinksDto) {
    return this.service.generateLinks(dto);
  }

  @Get()
  @Roles("ADMIN")
  async list(@Query() query: QueryFriendSourceLinksDto) {
    return this.service.getLinks(query);
  }

  @Get("summary")
  @Roles("ADMIN")
  async getSummary() {
    return this.service.getSummary();
  }

  @Get("attribution-configs")
  @Roles("ADMIN")
  async getAttributionConfigs() {
    return this.service.getAttributionConfigs();
  }

  @Put("attribution-configs/:lineOaId")
  @Roles("ADMIN")
  async upsertAttributionConfig(
    @Param("lineOaId") lineOaId: string,
    @Body() dto: UpsertFriendAttributionConfigDto
  ) {
    return this.service.upsertAttributionConfig(lineOaId, dto);
  }

  @Delete("attribution-configs/:lineOaId")
  @Roles("ADMIN")
  async deleteAttributionConfig(@Param("lineOaId") lineOaId: string) {
    return this.service.deleteAttributionConfig(lineOaId);
  }

  @Post("attribution-configs/bootstrap-legacy")
  @Roles("ADMIN")
  async bootstrapLegacyAttributionConfig() {
    const migrated = await this.service.backfillLegacyPilotAttributionConfig();
    return { migrated };
  }

  @Patch(":id")
  @Roles("ADMIN")
  async update(@Param("id") id: string, @Body() dto: UpdateFriendSourceLinkDto) {
    return this.service.updateLink(id, dto);
  }
}
