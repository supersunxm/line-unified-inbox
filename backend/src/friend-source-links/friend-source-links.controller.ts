import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { Roles } from "../auth/auth.decorators";
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

  @Patch(":id")
  @Roles("ADMIN")
  async update(@Param("id") id: string, @Body() dto: UpdateFriendSourceLinkDto) {
    return this.service.updateLink(id, dto);
  }
}
