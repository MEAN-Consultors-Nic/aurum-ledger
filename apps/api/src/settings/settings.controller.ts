import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { UpdateGithubSettingsDto } from './dto/github-settings.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@ApiBearerAuth()
@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  findAll() {
    return this.settingsService.getAll();
  }

  // ----- GitHub (dedicated, token-aware) -----
  // Must come before /:key so 'github' isn't treated as a key lookup.
  @Get('github')
  getGithub() {
    return this.settingsService.getGithubSettings();
  }

  @Put('github')
  updateGithub(
    @Body() dto: UpdateGithubSettingsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settingsService.updateGithubSettings(dto, user?._id?.toString());
  }

  @Get(':key')
  findByKey(@Param('key') key: string) {
    return this.settingsService.getValue(key);
  }

  @Put(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settingsService.setValue(key, dto.value, user?._id?.toString());
  }
}
