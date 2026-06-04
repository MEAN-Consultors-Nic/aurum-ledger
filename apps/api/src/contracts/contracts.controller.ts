import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { FilterContractDto } from './dto/filter-contract.dto';
import { OmitPaymentDto } from './dto/omit-payment.dto';
import { UpdateContractDto } from './dto/update-contract.dto';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
@UseGuards(JwtAuthGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  findAll(@Query() filter: FilterContractDto) {
    return this.contractsService.findAll(filter);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.contractsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateContractDto, @CurrentUser() user: RequestUser) {
    return this.contractsService.create(dto, user?._id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.contractsService.update(id, dto, user?._id);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.contractsService.cancel(id, user?._id);
  }

  @Post(':id/omit-payment')
  omitPayment(
    @Param('id') id: string,
    @Body() dto: OmitPaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.contractsService.omitPayment(id, dto, user?._id);
  }

  @Patch(':id/restore-payment')
  restorePayment(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.contractsService.restorePayment(id, user?._id);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.contractsService.softDelete(id, user?._id);
  }

  @Get(':id/financials')
  financials(@Param('id') id: string) {
    return this.contractsService.financials(id);
  }
}
