import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/auth.decorators";
import { MobileConfigService } from "./mobile-config.service";

@Controller("mobile")
export class MobileConfigController {
  constructor(private readonly config: MobileConfigService) {}
  @Public() @Get("config") get() { return this.config.get(); }
}
