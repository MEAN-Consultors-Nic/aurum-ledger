import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { ConvertToEstimateDto, CreateSiteAuditDto } from './dto/site-audit.dto';
import { SiteAuditService } from './site-audit.service';

@ApiTags('site-audit')
@ApiBearerAuth()
@Controller('site-audits')
@UseGuards(JwtAuthGuard)
export class SiteAuditController {
  constructor(private readonly audits: SiteAuditService) {}

  @Get()
  list(@Query('status') status?: string, @Query('q') q?: string) {
    return this.audits.list({ status, q });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.audits.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateSiteAuditDto, @CurrentUser() user: RequestUser) {
    return this.audits.create(dto, user?._id);
  }

  @Post(':id/regenerate-ai')
  regenerateAi(@Param('id') id: string) {
    return this.audits.regenerateAi(id);
  }

  @Post(':id/convert-to-estimate')
  convert(
    @Param('id') id: string,
    @Body() dto: ConvertToEstimateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.audits.convertToEstimate(id, dto, user?._id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.audits.remove(id);
  }
}
