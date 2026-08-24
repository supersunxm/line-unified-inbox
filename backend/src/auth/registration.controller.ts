import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { Public } from "./auth.decorators";
import { CreateHqRegistrationRequestDto, CreateRegistrationRequestDto } from "./registration.dto";
import { RegistrationService } from "./registration.service";
import { HqRegistrationService } from "./hq-registration.service";

@Controller("registration")
export class RegistrationController {
  constructor(private readonly registration: RegistrationService, private readonly hqRegistration: HqRegistrationService) {}
  @Public() @Get("stores") async stores() { return { stores: await this.registration.stores() }; }
  @Public() @Post("request") request(@Body() dto: CreateRegistrationRequestDto, @Req() request: Request) { return this.registration.request(dto, request.ip); }
  @Public() @Post("hq-request") requestHq(@Body() dto: CreateHqRegistrationRequestDto, @Req() request: Request) { return this.hqRegistration.request(dto, request.ip); }
}
