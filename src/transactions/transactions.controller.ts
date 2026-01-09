import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { TransactionsService } from './transactions.service';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Get()
  findAll(@Query() filter: FilterTransactionDto) {
    return this.transactionsService.findAll(filter);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.transactionsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateTransactionDto, @CurrentUser() user: RequestUser) {
    return this.transactionsService.create(dto, user?._id);
  }

  @Post('transfer')
  createTransfer(@Body() dto: CreateTransferDto, @CurrentUser() user: RequestUser) {
    return this.transactionsService.createTransfer(dto, user?._id);
  }
}
