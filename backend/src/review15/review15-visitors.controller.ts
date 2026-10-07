import {
  BadRequestException,
  Body,
  Controller,
  Post,
} from "@nestjs/common";
import { Public } from "../auth/auth.decorators";
import { Review15VisitorsService } from "./review15-visitors.service";

const VISITOR_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RecordVisitorBody = {
  visitorId?: string;
};

@Controller("review15")
export class Review15VisitorsController {
  constructor(private readonly visitors: Review15VisitorsService) {}

  @Public()
  @Post("visitors")
  recordVisitor(@Body() body: RecordVisitorBody) {
    const visitorId = body?.visitorId?.trim();

    if (!visitorId || !VISITOR_ID.test(visitorId)) {
      throw new BadRequestException("A valid anonymous visitor ID is required");
    }

    return this.visitors.recordVisitor(visitorId);
  }
}
