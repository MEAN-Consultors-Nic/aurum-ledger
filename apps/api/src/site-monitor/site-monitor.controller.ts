import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { CreateSiteMonitorDto } from './dto/create-site-monitor.dto';
import { UpdateSiteMonitorDto } from './dto/update-site-monitor.dto';
import { SiteMonitorService } from './site-monitor.service';

@ApiTags('site-monitor')
@ApiBearerAuth()
@Controller('site-monitor')
@UseGuards(JwtAuthGuard)
export class SiteMonitorController {
  constructor(private readonly monitorService: SiteMonitorService) {}

  @Get()
  list() {
    return this.monitorService.list();
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.monitorService.findById(id);
  }

  @Post()
  create(@Body() dto: CreateSiteMonitorDto, @CurrentUser() user: RequestUser) {
    return this.monitorService.create(dto, user?._id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSiteMonitorDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.monitorService.update(id, dto, user?._id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.monitorService.remove(id, user?._id);
  }

  @Post(':id/check')
  checkNow(@Param('id') id: string) {
    return this.monitorService.checkNow(id);
  }
}
