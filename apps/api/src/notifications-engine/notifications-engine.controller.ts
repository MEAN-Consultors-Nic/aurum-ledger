import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { ManualSendDto } from './dto/manual-send.dto';
import { CreateRuleDto, UpdateRuleDto } from './dto/rule.dto';
import { CreateTemplateGroupDto, UpdateTemplateGroupDto } from './dto/template-group.dto';
import {
  CreateTemplateDto,
  PreviewTemplateDto,
  TestSendDto,
  UpdateTemplateDto,
} from './dto/template.dto';
import { NotificationsEngineService } from './notifications-engine.service';

@ApiTags('notifications-engine')
@ApiBearerAuth()
@Controller('notification-center')
@UseGuards(JwtAuthGuard)
export class NotificationsEngineController {
  constructor(private readonly engine: NotificationsEngineService) {}

  @Get('events')
  events() {
    return this.engine.getEventCatalog();
  }

  // ----- Groups -----
  @Get('groups')
  listGroups() {
    return this.engine.listGroups();
  }
  @Post('groups')
  createGroup(@Body() dto: CreateTemplateGroupDto, @CurrentUser() user: RequestUser) {
    return this.engine.createGroup(dto, user?._id);
  }
  @Patch('groups/:id')
  updateGroup(@Param('id') id: string, @Body() dto: UpdateTemplateGroupDto) {
    return this.engine.updateGroup(id, dto);
  }
  @Delete('groups/:id')
  deleteGroup(@Param('id') id: string) {
    return this.engine.deleteGroup(id);
  }

  // ----- Templates -----
  @Get('templates')
  listTemplates(
    @Query('groupId') groupId?: string,
    @Query('eventKey') eventKey?: string,
  ) {
    return this.engine.listTemplates({ groupId, eventKey });
  }
  @Get('templates/:id')
  findTemplate(@Param('id') id: string) {
    return this.engine.findTemplateById(id);
  }
  @Post('templates')
  createTemplate(@Body() dto: CreateTemplateDto, @CurrentUser() user: RequestUser) {
    return this.engine.createTemplate(dto, user?._id);
  }
  @Patch('templates/:id')
  updateTemplate(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.engine.updateTemplate(id, dto, user?._id);
  }
  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.engine.deleteTemplate(id);
  }
  @Post('templates/preview')
  preview(@Body() dto: PreviewTemplateDto) {
    return this.engine.preview(dto);
  }

  @Post('manual-send')
  manualSend(@Body() dto: ManualSendDto, @CurrentUser() user: RequestUser) {
    return this.engine.manualSend(dto, user?._id);
  }
  @Post('templates/:id/test-send')
  testSend(
    @Param('id') id: string,
    @Body() dto: TestSendDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.engine.testSend(id, dto, user?._id);
  }

  // ----- Rules -----
  @Get('rules')
  listRules(@Query('eventKey') eventKey?: string, @Query('enabled') enabled?: string) {
    return this.engine.listRules({
      eventKey,
      enabled: enabled === undefined ? undefined : enabled === 'true',
    });
  }
  @Post('rules')
  createRule(@Body() dto: CreateRuleDto, @CurrentUser() user: RequestUser) {
    return this.engine.createRule(dto, user?._id);
  }
  @Patch('rules/:id')
  updateRule(
    @Param('id') id: string,
    @Body() dto: UpdateRuleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.engine.updateRule(id, dto, user?._id);
  }
  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) {
    return this.engine.deleteRule(id);
  }

  // ----- Log -----
  @Get('log')
  log(
    @Query('eventKey') eventKey?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.engine.listLog({
      eventKey,
      status,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
