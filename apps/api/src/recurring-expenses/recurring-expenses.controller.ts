import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { FilterRecurringExpenseDto } from './dto/filter-recurring-expense.dto';
import { RecurringOccurrenceQueryDto } from './dto/occurrence-query.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';
import { RecurringExpensesService } from './recurring-expenses.service';

@ApiTags('recurring-expenses')
@ApiBearerAuth()
@Controller('recurring-expenses')
@UseGuards(JwtAuthGuard)
export class RecurringExpensesController {
  constructor(private readonly recurringExpensesService: RecurringExpensesService) {}

  @Get()
  findAll(@Query() filter: FilterRecurringExpenseDto) {
    return this.recurringExpensesService.findAll(filter);
  }

  @Post()
  create(@Body() dto: CreateRecurringExpenseDto, @CurrentUser() user: RequestUser) {
    return this.recurringExpensesService.create(dto, user?._id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRecurringExpenseDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.recurringExpensesService.update(id, dto, user?._id);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.recurringExpensesService.softDelete(id, user?._id);
  }

  @Get('occurrences')
  listOccurrences(@Query() query: RecurringOccurrenceQueryDto) {
    return this.recurringExpensesService.listOccurrences(query.month);
  }

  @Post('occurrences/:id/confirm')
  confirmOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.recurringExpensesService.confirmOccurrence(id, user?._id);
  }

  @Post('occurrences/:id/omit')
  omitOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.recurringExpensesService.omitOccurrence(id, user?._id);
  }

  @Post('occurrences/:id/reactivate')
  reactivateOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.recurringExpensesService.reactivateOccurrence(id, user?._id);
  }

  @Get('alerts')
  getAlerts(@Query() query: RecurringOccurrenceQueryDto) {
    return this.recurringExpensesService.getAlerts(query.month);
  }
}
