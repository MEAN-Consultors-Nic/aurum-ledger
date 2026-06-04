import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { ConfirmOccurrenceDto } from './dto/confirm-occurrence.dto';
import { CreatePlannedIncomeDto } from './dto/create-planned-income.dto';
import { FilterPlannedIncomeDto } from './dto/filter-planned-income.dto';
import { OccurrenceQueryDto } from './dto/occurrence-query.dto';
import { UpdatePlannedIncomeDto } from './dto/update-planned-income.dto';
import { PlannedIncomesService } from './planned-incomes.service';

@ApiTags('planned-incomes')
@ApiBearerAuth()
@Controller('planned-incomes')
@UseGuards(JwtAuthGuard)
export class PlannedIncomesController {
  constructor(private readonly plannedIncomesService: PlannedIncomesService) {}

  @Get()
  findAll(@Query() filter: FilterPlannedIncomeDto) {
    return this.plannedIncomesService.findAll(filter);
  }

  @Post()
  create(@Body() dto: CreatePlannedIncomeDto, @CurrentUser() user: RequestUser) {
    return this.plannedIncomesService.create(dto, user?._id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePlannedIncomeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plannedIncomesService.update(id, dto, user?._id);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.plannedIncomesService.softDelete(id, user?._id);
  }

  @Get('occurrences')
  listOccurrences(@Query() query: OccurrenceQueryDto) {
    return this.plannedIncomesService.listOccurrences(query.month);
  }

  @Post('occurrences/:id/confirm')
  confirmOccurrence(
    @Param('id') id: string,
    @Body() dto: ConfirmOccurrenceDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.plannedIncomesService.confirmOccurrence(id, dto, user?._id);
  }

  @Post('occurrences/:id/omit')
  omitOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.plannedIncomesService.omitOccurrence(id, user?._id);
  }

  @Post('occurrences/:id/reactivate')
  reactivateOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.plannedIncomesService.reactivateOccurrence(id, user?._id);
  }

  @Get('alerts')
  getAlerts(@Query() query: OccurrenceQueryDto) {
    return this.plannedIncomesService.getAlerts(query.month);
  }

  @Get('summary')
  getSummary(@Query() query: OccurrenceQueryDto) {
    return this.plannedIncomesService.getSummary(query.month);
  }
}
