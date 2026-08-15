import { Controller, Get, Param, Query } from "@nestjs/common";
import { MobileProductQueryDto, MobileProductVariantQueryDto } from "./mobile-conversations.dto";
import { MobileConversationsService } from "./mobile-conversations.service";

@Controller("mobile/products")
export class MobileProductsController {
  constructor(private readonly conversations: MobileConversationsService) {}

  @Get()
  list(@Query() query: MobileProductQueryDto) { return this.conversations.products(query); }

  @Get(":productId/variants")
  variants(@Param("productId") productId: string, @Query() query: MobileProductVariantQueryDto) {
    return this.conversations.productVariants(productId, query);
  }
}
