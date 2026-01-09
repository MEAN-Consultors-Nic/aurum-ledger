import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';

@ApiTags('reports')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard/overview')
  overview() {
    return this.reportsService.dashboardOverview();
  }

  @Get('reports/receivables')
  receivables(@Query('groupBy') groupBy: 'client' | 'service' = 'client') {
    return this.reportsService.receivables(groupBy);
  }

  @Get('reports/payments')
  payments(@Query('from') from?: string, @Query('to') to?: string) {
    return this.reportsService.paymentsReport(from, to);
  }
}
