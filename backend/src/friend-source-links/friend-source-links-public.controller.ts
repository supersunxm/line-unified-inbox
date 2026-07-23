import { Controller, Get, Param, Req, Res } from "@nestjs/common";
import { Request, Response } from "express";
import { Public } from "../auth/auth.decorators";
import { FriendSourceLinksService } from "./friend-source-links.service";

@Controller("f")
export class FriendSourceLinksPublicController {
  constructor(private readonly service: FriendSourceLinksService) {}

  @Get(":shortCode")
  @Public()
  async redirect(@Param("shortCode") shortCode: string, @Req() req: Request, @Res() res: Response) {
    const referrer = (req.headers["referer"] || req.headers["referrer"]) as string | undefined;
    const userAgent = req.headers["user-agent"];
    const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req.headers["x-real-ip"] as string | undefined) ||
      req.ip ||
      req.socket?.remoteAddress ||
      "";

    const redirectUrl = await this.service.handleRedirect(shortCode, referrer, userAgent, clientIp);
    return res.redirect(302, redirectUrl);
  }
}
