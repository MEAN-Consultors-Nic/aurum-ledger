import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@ApiBearerAuth()
@Controller('finance')
@UseGuards(JwtAuthGuard)
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('overview')
  overview() {
    return this.financeService.overview();
  }

  @Get('by-category')
  byCategory(@Query('month') month?: string, @Query('year') year?: string) {
    return this.financeService.byCategory(
      month ? Number(month) : undefined,
      year ? Number(year) : undefined,
    );
  }

  @Get('by-client')
  byClient(@Query('from') from?: string, @Query('to') to?: string) {
    return this.financeService.byClient(from, to);
  }

  @Get('by-contract')
  byContract(@Query('from') from?: string, @Query('to') to?: string) {
    return this.financeService.byContract(from, to);
  }
}
