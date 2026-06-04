import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { ConvertEstimateDto } from './dto/convert-estimate.dto';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { FilterEstimateDto } from './dto/filter-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { EstimatesService } from './estimates.service';

@ApiTags('estimates')
@ApiBearerAuth()
@Controller('estimates')
@UseGuards(JwtAuthGuard)
export class EstimatesController {
  constructor(private readonly estimatesService: EstimatesService) {}

  @Get()
  findAll(@Query() filter: FilterEstimateDto) {
    return this.estimatesService.findAll(filter);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.estimatesService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateEstimateDto, @CurrentUser() user: RequestUser) {
    return this.estimatesService.create(dto, user?._id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateEstimateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.estimatesService.update(id, dto, user?._id);
  }

  @Delete(':id')
  softDelete(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.estimatesService.softDelete(id, user?._id);
  }

  @Post(':id/convert')
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertEstimateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.estimatesService.convertToContract(id, dto, user?._id);
  }

  @Post(':id/share')
  generateShare(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.estimatesService.generateShareToken(id, user?._id);
  }

  @Delete(':id/share')
  revokeShare(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.estimatesService.revokeShareToken(id, user?._id);
  }
}
