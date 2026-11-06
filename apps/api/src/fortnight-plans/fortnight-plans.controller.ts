import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import {
  AnalyticsQueryDto,
  ApplyLineDto,
  ClosePlanDto,
  CreateLineDto,
  OpenPlanDto,
  PromoteLineDto,
  RecordUnplannedDto,
  UpdateLineDto,
  UpdatePlanDto,
} from './dto/fortnight-plan.dto';
import { FortnightPlansService } from './fortnight-plans.service';

/**
 * Bi-weekly planner. A plan is addressed by its fortnight key:
 * "2026-11-1" is Nov 1–15, "2026-11-2" is Nov 16–30.
 */
@ApiTags('fortnight-plans')
@ApiBearerAuth()
@Controller('fortnight-plans')
@UseGuards(JwtAuthGuard)
export class FortnightPlansController {
  constructor(private readonly plans: FortnightPlansService) {}

  /** Recent fortnights, newest first. */
  @Get()
  list(@Query() query: AnalyticsQueryDto) {
    return this.plans.list(query.limit ?? 24);
  }

  /** Planned vs actual, unplanned spending and discipline score across recent fortnights. */
  @Get('analytics')
  analytics(@Query() query: AnalyticsQueryDto) {
    return this.plans.analytics(query.limit ?? 12);
  }

  /** The plan of one fortnight with its live summary. `plan` is null until it is opened. */
  @Get(':periodKey')
  get(@Param('periodKey') periodKey: string) {
    return this.plans.getDetail(periodKey);
  }

  /** Opens a fortnight (idempotent): repeats lines marked to repeat and pulls every scheduled item. */
  @Post()
  open(@Body() dto: OpenPlanDto, @CurrentUser() user: RequestUser) {
    return this.plans.open(dto.periodKey, user?._id);
  }

  @Patch(':periodKey')
  update(
    @Param('periodKey') periodKey: string,
    @Body() dto: UpdatePlanDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.update(periodKey, dto, user?._id);
  }

  /** Discards a plan with nothing executed in it. */
  @Delete(':periodKey')
  remove(@Param('periodKey') periodKey: string) {
    return this.plans.remove(periodKey);
  }

  /** Pulls new items from loans, recurring expenses, subscriptions and planned income. */
  @Post(':periodKey/sync')
  sync(@Param('periodKey') periodKey: string) {
    return this.plans.sync(periodKey);
  }

  /** Closes the fortnight; pending lines move to the next one (default) or are dropped. */
  @Post(':periodKey/close')
  close(
    @Param('periodKey') periodKey: string,
    @Body() dto: ClosePlanDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.close(periodKey, dto, user?._id);
  }

  /** Finishes the planning wizard: the draft becomes the plan to track. */
  @Post(':periodKey/confirm')
  confirm(
    @Param('periodKey') periodKey: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.confirmPlan(periodKey, user?._id);
  }

  @Post(':periodKey/reopen')
  reopen(
    @Param('periodKey') periodKey: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.reopen(periodKey, user?._id);
  }

  /** Records spending (or income) that was not planned, directly into the books. */
  @Post(':periodKey/unplanned')
  recordUnplanned(
    @Param('periodKey') periodKey: string,
    @Body() dto: RecordUnplannedDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.recordUnplanned(periodKey, dto, user?._id);
  }

  @Post(':periodKey/lines')
  addLine(
    @Param('periodKey') periodKey: string,
    @Body() dto: CreateLineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.addLine(periodKey, dto, user?._id);
  }

  @Patch(':periodKey/lines/:lineId')
  updateLine(
    @Param('periodKey') periodKey: string,
    @Param('lineId') lineId: string,
    @Body() dto: UpdateLineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.updateLine(periodKey, lineId, dto, user?._id);
  }

  @Delete(':periodKey/lines/:lineId')
  removeLine(
    @Param('periodKey') periodKey: string,
    @Param('lineId') lineId: string,
  ) {
    return this.plans.removeLine(periodKey, lineId);
  }

  /** Executes the line: records the movement (once) and marks it applied. */
  @Post(':periodKey/lines/:lineId/apply')
  applyLine(
    @Param('periodKey') periodKey: string,
    @Param('lineId') lineId: string,
    @Body() dto: ApplyLineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.applyLine(periodKey, lineId, dto, user?._id);
  }

  /** Voids the movement of a manual line and returns it to planned. */
  @Post(':periodKey/lines/:lineId/unapply')
  unapplyLine(
    @Param('periodKey') periodKey: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.unapplyLine(periodKey, lineId, user?._id);
  }

  @Post(':periodKey/lines/:lineId/skip')
  skipLine(
    @Param('periodKey') periodKey: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.skipLine(periodKey, lineId, user?._id);
  }

  @Post(':periodKey/lines/:lineId/restore')
  restoreLine(
    @Param('periodKey') periodKey: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.restoreLine(periodKey, lineId, user?._id);
  }

  /** Cancels the occurrence in its own module (loan, recurring expense, subscription, income). */
  @Post(':periodKey/lines/:lineId/omit')
  omitLine(
    @Param('periodKey') periodKey: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.omitLine(periodKey, lineId, user?._id);
  }

  @Post(':periodKey/lines/:lineId/carry')
  carryLine(
    @Param('periodKey') periodKey: string,
    @Param('lineId') lineId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.carryLine(periodKey, lineId, user?._id);
  }

  /** Turns a manual expense into a recurring expense. */
  @Post(':periodKey/lines/:lineId/promote')
  promoteLine(
    @Param('periodKey') periodKey: string,
    @Param('lineId') lineId: string,
    @Body() dto: PromoteLineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plans.promoteLine(periodKey, lineId, dto, user?._id);
  }
}
