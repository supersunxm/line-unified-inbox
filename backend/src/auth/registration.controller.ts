import { Body, Controller, Get, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { Public } from "./auth.decorators";
import { CreateRegistrationRequestDto } from "./registration.dto";
import { RegistrationService } from "./registration.service";

@Controller("registration")
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}
  @Public() @Get("stores") async stores() { return { stores: await this.registration.stores() }; }
  @Public() @Post("request") request(@Body() dto: CreateRegistrationRequestDto, @Req() request: Request) { return this.registration.request(dto, request.ip); }
}
