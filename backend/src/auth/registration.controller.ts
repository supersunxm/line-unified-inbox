import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { Public } from "./auth.decorators";
import { CreateRegistrationRequestDto, VerifyRegistrationOtpDto } from "./registration.dto";
import { RegistrationService } from "./registration.service";

@Controller("registration")
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}
  @Public() @Get("stores") stores() { return this.registration.stores(); }
  @Public() @Post("request") request(@Body() dto: CreateRegistrationRequestDto) { return this.registration.request(dto); }
  @Public() @Post(":id/verify-otp") verify(@Param("id") id: string, @Body() dto: VerifyRegistrationOtpDto) { return this.registration.verify(id, dto.otp); }
}
