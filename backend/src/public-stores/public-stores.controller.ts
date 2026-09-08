import { Controller, Get, Param, Query } from "@nestjs/common";
import { Public } from "../auth/auth.decorators";
import { PublicStoresService } from "./public-stores.service";

@Controller("public/stores")
export class PublicStoresController {
  constructor(private readonly service: PublicStoresService) {}

  @Get()
  @Public()
  list(
    @Query("q") q?: string,
    @Query("province") province?: string,
    @Query("region") region?: string,
    @Query("limit") limitRaw?: string
  ) {
    const parsedLimit = limitRaw ? Number.parseInt(limitRaw, 10) : undefined;
    const limit =
      Number.isFinite(parsedLimit) && parsedLimit! > 0
        ? Math.min(parsedLimit!, 500)
        : undefined;

    return this.service.getStores({
      q,
      province,
      region,
      limit,
    });
  }

  @Get(":identifier")
  @Public()
  getByIdentifier(@Param("identifier") identifier: string) {
    return this.service.getStoreByIdentifier(identifier);
  }
}
