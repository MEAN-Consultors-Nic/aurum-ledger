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
import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { CustomFieldEntityType } from './schemas/custom-field.schema';

@ApiTags('custom-fields')
@ApiBearerAuth()
@Controller('custom-fields')
@UseGuards(JwtAuthGuard)
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  @Get()
  list(@Query('entityType') entityType?: CustomFieldEntityType) {
    return this.customFieldsService.list(entityType);
  }

  @Post()
  create(@Body() dto: CreateCustomFieldDto, @CurrentUser() user: RequestUser) {
    return this.customFieldsService.create(dto, user?._id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomFieldDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.customFieldsService.update(id, dto, user?._id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.customFieldsService.remove(id, user?._id);
  }
}
