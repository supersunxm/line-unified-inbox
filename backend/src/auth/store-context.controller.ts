import { Controller, Get, Req } from "@nestjs/common";
import { AuthRequest } from "./auth.guard";
import { StoreAccessService } from "./store-access.service";

@Controller("auth/store-context")
export class StoreContextController {
  constructor(private readonly storeAccess: StoreAccessService) {}

  @Get("stores")
  async stores(@Req() request: AuthRequest) {
    return { items: await this.storeAccess.listActAsStoreOptions(request.user!) };
  }
}
