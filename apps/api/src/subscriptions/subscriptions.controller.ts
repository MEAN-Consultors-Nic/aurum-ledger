import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { FilterSubscriptionDto } from './dto/filter-subscription.dto';
import { SubscriptionOccurrenceQueryDto } from './dto/occurrence-query.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { SubscriptionsService } from './subscriptions.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  findAll(@Query() filter: FilterSubscriptionDto) {
    return this.subscriptionsService.findAll(filter);
  }

  @Post()
  create(@Body() dto: CreateSubscriptionDto, @CurrentUser() user: RequestUser) {
    return this.subscriptionsService.create(dto, user?._id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.subscriptionsService.update(id, dto, user?._id);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.subscriptionsService.softDelete(id, user?._id);
  }

  @Get('occurrences')
  listOccurrences(@Query() query: SubscriptionOccurrenceQueryDto) {
    return this.subscriptionsService.listOccurrences(query.month);
  }

  @Post('occurrences/:id/confirm')
  confirmOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.subscriptionsService.confirmOccurrence(id, user?._id);
  }

  @Post('occurrences/:id/omit')
  omitOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.subscriptionsService.omitOccurrence(id, user?._id);
  }

  @Post('occurrences/:id/reactivate')
  reactivateOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.subscriptionsService.reactivateOccurrence(id, user?._id);
  }

  @Get('alerts')
  getAlerts(@Query() query: SubscriptionOccurrenceQueryDto) {
    return this.subscriptionsService.getAlerts(query.month);
  }
}
