import { Controller, Get, Query } from "@nestjs/common";
import { MobileProductQueryDto } from "./mobile-conversations.dto";
import { MobileConversationsService } from "./mobile-conversations.service";

@Controller("mobile/products")
export class MobileProductsController {
  constructor(private readonly conversations: MobileConversationsService) {}

  @Get()
  list(@Query() query: MobileProductQueryDto) { return this.conversations.products(query); }
}
