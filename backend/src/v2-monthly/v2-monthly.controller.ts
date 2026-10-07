import { BadRequestException, Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req } from "@nestjs/common";
import { Roles } from "../auth/auth.decorators";
import type { AuthRequest } from "../auth/auth.guard";
import { StoreAccessService } from "../auth/store-access.service";
import { CLOSED_BY_ADMIN, MonthCloseService } from "./month-close.service";
import { closeDueAt, isMonth, MONTH_CLOSE_GRACE_DAYS } from "./month-close-rules";
import { NicknameTagsV4Service } from "./nickname-tags-v4.service";
import { StorePartnersService } from "./store-partners.service";
import { TagCoverageService } from "./tag-coverage.service";
import { CloseMonthDto, RederiveTagsDto, SetStorePartnerDto } from "./v2-monthly.dto";

@Controller("v2")
export class V2MonthlyController {
  constructor(
    private readonly partners: StorePartnersService,
    private readonly monthClose: MonthCloseService,
    private readonly tags: NicknameTagsV4Service,
    private readonly tagCoverage: TagCoverageService,
    private readonly storeAccess: StoreAccessService,
  ) {}

  private async scope(req: AuthRequest) {
    if (!req.user) throw new ForbiddenException("Authentication required");
    return this.storeAccess.accessibleStoreIds(req.user);
  }

  /** Store → partner for the caller's stores (v2 reads partner only from here). */
  @Get("store-partners")
  async listStorePartners(@Req() req: AuthRequest) {
    return { stores: await this.partners.list(await this.scope(req)) };
  }

  @Get("store-partners/changes")
  @Roles("ADMIN")
  async storePartnerChanges(@Query("storeId") storeId?: string, @Query("limit") limit?: string) {
    return { changes: await this.partners.changes(storeId?.trim() || null, Number(limit) || 50) };
  }

  @Put("store-partners/:storeId")
  @Roles("ADMIN")
  async setStorePartner(@Param("storeId") storeId: string, @Body() body: SetStorePartnerDto, @Req() req: AuthRequest) {
    const user = req.user!;
    return this.partners.setPartner(storeId, body.partner ?? null, { id: user.id, name: user.displayName || user.email }, body.reason ?? null);
  }

  /** Idempotent: does nothing once the seed has run. */
  @Post("store-partners/seed")
  @Roles("ADMIN")
  async seedStorePartners() {
    return this.partners.seedFromStoreNames();
  }

  /**
   * A month's current snapshot (latest revision), limited to the caller's stores, or close: null
   * while the month is open. dueAt says when it closes automatically.
   */
  @Get("month-close/:month")
  async monthSnapshot(@Param("month") month: string, @Req() req: AuthRequest) {
    if (!isMonth(month)) throw new BadRequestException("month must be YYYY-MM");
    const snapshot = await this.monthClose.snapshot(month, await this.scope(req));
    return { ...snapshot, dueAt: closeDueAt(month).toISOString(), graceDays: MONTH_CLOSE_GRACE_DAYS };
  }

  /** Every close of a month (all revisions), newest first. */
  @Get("month-closes")
  @Roles("ADMIN")
  async monthCloses(@Query("month") month?: string) {
    return { closes: await this.monthClose.closes(month && isMonth(month) ? month : undefined) };
  }

  /** Admin close: the first close of an ended month, or a re-close (reason required) that keeps earlier revisions. */
  @Post("month-close/:month")
  @Roles("ADMIN")
  async closeMonth(@Param("month") month: string, @Body() body: CloseMonthDto, @Req() req: AuthRequest) {
    const user = req.user!;
    return this.monthClose.close(month, { closedBy: CLOSED_BY_ADMIN, actorId: user.id, actorName: user.displayName || user.email, reason: body.reason ?? null });
  }

  /**
   * Tag coverage per store for a month (counts only, the caller's stores): chats, chats whose
   * nickname was read, with ≥ 1 tag, with a valid MM/YY, and by tag type. Same chats as /chats.
   */
  @Get("tag-coverage")
  async tagCoverageByStore(@Query("month") month: string, @Req() req: AuthRequest) {
    return this.tagCoverage.coverage(month, await this.scope(req));
  }

  /** Parser v4 re-derive runs (counts only), newest first. */
  @Get("tags/rederive-runs")
  @Roles("ADMIN")
  async tagRederiveRuns(@Query("limit") limit?: string) {
    return { runs: await this.tags.runs(Number(limit) || 50) };
  }

  /**
   * Starts a full Parser v4 re-derive (or continues the one in progress) and runs one bounded
   * step (≤ 20 batches of 500 conversations). Idempotent; the scheduler continues it.
   */
  @Post("tags/rederive")
  @Roles("ADMIN")
  async rederiveTags(@Body() body: RederiveTagsDto, @Req() req: AuthRequest) {
    const user = req.user!;
    const run = await this.tags.startFull({ trigger: "ADMIN", actorName: user.displayName || user.email, reason: body.reason ?? null });
    return this.tags.continueFull(run.id);
  }
}
