import { Controller, Get, Req } from "@nestjs/common";
import type { AuthRequest } from "../../auth/auth.guard";
import { assertSunnSecretaryOwner, sunnSecretarySetupStatus } from "./sunn-secretary-owner-settings";

@Controller("sunn-secretary/owner")
export class SunnSecretaryOwnerSettingsController {
  @Get("status")
  status(@Req() request: AuthRequest) {
    assertSunnSecretaryOwner(request.user, process.env.SUNN_SECRETARY_OWNER_HQ_USER_ID);
    return sunnSecretarySetupStatus(process.env);
  }
}
