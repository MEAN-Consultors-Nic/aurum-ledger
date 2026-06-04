import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { CreateLoanDto } from './dto/create-loan.dto';
import { FilterLoanDto } from './dto/filter-loan.dto';
import { LoanOccurrenceQueryDto } from './dto/occurrence-query.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { LoansService } from './loans.service';

@ApiTags('loans')
@ApiBearerAuth()
@Controller('loans')
@UseGuards(JwtAuthGuard)
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  findAll(@Query() filter: FilterLoanDto) {
    return this.loansService.findAll(filter);
  }

  @Post()
  create(@Body() dto: CreateLoanDto, @CurrentUser() user: RequestUser) {
    return this.loansService.create(dto, user?._id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLoanDto, @CurrentUser() user: RequestUser) {
    return this.loansService.update(id, dto, user?._id);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.loansService.softDelete(id, user?._id);
  }

  @Get('occurrences')
  listOccurrences(@Query() query: LoanOccurrenceQueryDto) {
    return this.loansService.listOccurrences(query.month);
  }

  @Post('occurrences/:id/confirm')
  confirmOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.loansService.confirmOccurrence(id, user?._id);
  }

  @Post('occurrences/:id/omit')
  omitOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.loansService.omitOccurrence(id, user?._id);
  }

  @Post('occurrences/:id/reactivate')
  reactivateOccurrence(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.loansService.reactivateOccurrence(id, user?._id);
  }

  @Get('alerts')
  getAlerts(@Query() query: LoanOccurrenceQueryDto) {
    return this.loansService.getAlerts(query.month);
  }
}
