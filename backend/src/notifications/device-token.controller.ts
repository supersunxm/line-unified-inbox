import { Body, Controller, Delete, Post, Req } from "@nestjs/common";
import { AuthRequest } from "../auth/auth.guard";
import { DeviceTokenDto, RegisterDeviceTokenDto } from "./device-token.dto";
import { DeviceTokenService } from "./device-token.service";

@Controller("device-tokens")
export class DeviceTokenController {
  constructor(private readonly devices: DeviceTokenService) {}

  @Post()
  register(@Req() request: AuthRequest, @Body() dto: RegisterDeviceTokenDto) { return this.devices.register(request.user!.id, dto); }

  @Delete()
  unregister(@Req() request: AuthRequest, @Body() dto: DeviceTokenDto) { return this.devices.unregister(request.user!.id, dto.token); }

  @Post("last-seen")
  touch(@Req() request: AuthRequest, @Body() dto: DeviceTokenDto) { return this.devices.touch(request.user!.id, dto.token); }
}
