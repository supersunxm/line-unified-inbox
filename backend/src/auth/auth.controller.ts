import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { IsEmail, IsIn, IsNotEmpty, IsString, Length, MinLength } from "class-validator";
import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { Public } from "./auth.decorators";
import { AuthRequest } from "./auth.guard";
import { SetupService } from "./setup.service";
import { sessionCookieOptions } from "./session-cookie";
import { MobilePasswordLoginDto, MobileSendOtpDto, MobileVerifyOtpDto } from "./mobile-auth.dto";
import { SessionType } from "@prisma/client";
import { MobileAuthService } from "./mobile-auth.service";

class LoginDto { @IsString() @IsNotEmpty() identifier!: string; @IsString() @IsNotEmpty() password!: string; }
class SetupRequestDto { @IsString() @IsNotEmpty() displayName!: string; @IsEmail() email!: string; @IsString() @MinLength(12) password!: string; @IsIn(["th", "en", "zh"]) language: "th" | "en" | "zh" = "en"; }
class SetupVerifyDto extends SetupRequestDto { @IsString() challengeId!: string; @IsString() @Length(6, 6) otp!: string; }
class ResendDto { @IsString() challengeId!: string; @IsIn(["th", "en", "zh"]) language: "th" | "en" | "zh" = "en"; }
class ChangePasswordDto { @IsString() @IsNotEmpty() currentPassword!: string; @IsString() @MinLength(12) newPassword!: string; }

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly setup: SetupService, private readonly mobile: MobileAuthService) {}
  @Public() @Get("setup-status") setupStatus() { return this.setup.status(); }
  @Public() @Post("setup/request-otp") requestOtp(@Body() dto: SetupRequestDto) { return this.setup.requestOtp(dto.displayName, dto.email, dto.password, dto.language); }
  @Public() @Post("setup/resend-otp") resendOtp(@Body() dto: ResendDto) { return this.setup.resend(dto.challengeId, dto.language); }
  @Public() @Post("setup/verify-otp") async verifyOtp(@Body() dto: SetupVerifyDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.setup.verify(dto.challengeId, dto.email, dto.displayName, dto.password, dto.otp);
    response.cookie("oppo_session", result.token, { ...sessionCookieOptions(), expires: result.expiresAt }); return result.user;
  }
  @Public() @Post("login") async login(@Body() dto: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.login(dto.identifier, dto.password, SessionType.WEB, request.ip, request.get("user-agent"));
    response.cookie("oppo_session", result.token, { ...sessionCookieOptions(), expires: result.expiresAt });
    return result.user;
  }
  @Public() @Post("mobile/login") async mobileLogin(@Body() dto: MobilePasswordLoginDto, @Req() request: Request) {
    const result = await this.auth.login(dto.email, dto.password, SessionType.MOBILE, request.ip, request.get("user-agent"));
    return { accessToken: result.token, expiresAt: result.expiresAt, mustChangePassword: Boolean(result.user.mustChangePassword) };
  }
  @Public() @Post("mobile/send-otp") mobileSendOtp(@Body() dto: MobileSendOtpDto) { return this.mobile.sendOtp(dto.phone); }
  @Public() @Post("mobile/verify-otp") mobileVerifyOtp(@Body() dto: MobileVerifyOtpDto) { return this.mobile.verifyOtp(dto.challengeId, dto.otp); }
  @Post("logout") async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const token = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith("oppo_session="))?.slice("oppo_session=".length);
    await this.auth.logout(token, request.ip, request.get("user-agent")); response.clearCookie("oppo_session", sessionCookieOptions()); return { success: true };
  }
  @Get("me") me(@Req() request: AuthRequest) { return request.user; }
  @Post("change-password") changePassword(@Body() dto: ChangePasswordDto, @Req() request: AuthRequest) { return this.auth.changePassword(request.user!.id, dto.currentPassword, dto.newPassword); }
  @Public() @Post("mobile/logout") async mobileLogout(@Req() request: Request) {
    const token = request.headers.authorization?.startsWith("Bearer ") ? request.headers.authorization.slice("Bearer ".length).trim() : undefined;
    await this.auth.logoutMobile(token);
    return { success: true };
  }
}
