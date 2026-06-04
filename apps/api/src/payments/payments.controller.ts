import { Body, Controller, Delete, Get, Logger, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FilterPaymentDto } from './dto/filter-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(@Query() filter: FilterPaymentDto) {
    return this.paymentsService.findAll(filter);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreatePaymentDto, @CurrentUser() user: RequestUser) {
    this.logger.log(
      `Create payment clientId=${dto.clientId} contractId=${dto.contractId} amount=${dto.amount} retention=${dto.retentionAmount ?? 0} currency=${dto.currency} fx=${dto.exchangeRate} date=${dto.paymentDate} method=${dto.method}`,
    );
    try {
      return await this.paymentsService.create(dto, user?._id);
    } catch (error) {
      this.logger.error('Create payment failed', error as Error);
      throw error;
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id') id: string) {
    return this.paymentsService.remove(id);
  }
}
