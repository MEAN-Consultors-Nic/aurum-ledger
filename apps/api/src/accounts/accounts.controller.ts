import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { FilterAccountDto } from './dto/filter-account.dto';
import { ResetAccountDto } from './dto/reset-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@ApiTags('accounts')
@ApiBearerAuth()
@Controller('accounts')
@UseGuards(JwtAuthGuard)
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get()
  findAll(@Query() filter: FilterAccountDto) {
    return this.accountsService.findAll(filter);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.accountsService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateAccountDto, @CurrentUser() user: RequestUser) {
    return this.accountsService.create(dto, user?._id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAccountDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.accountsService.update(id, dto, user?._id);
  }

  @Post(':id/reset')
  resetBalance(
    @Param('id') id: string,
    @Body() dto: ResetAccountDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.accountsService.resetBalance(id, dto, user?._id);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.accountsService.softDelete(id, user?._id);
  }
}
