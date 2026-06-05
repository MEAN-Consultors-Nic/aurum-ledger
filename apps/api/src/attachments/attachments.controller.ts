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
import { AttachmentsService } from './attachments.service';
import { PresignAttachmentDto } from './dto/presign.dto';
import { AttachmentParentType } from './schemas/attachment.schema';

@ApiTags('attachments')
@ApiBearerAuth()
@Controller('attachments')
@UseGuards(JwtAuthGuard)
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get()
  list(
    @Query('parentType') parentType: AttachmentParentType,
    @Query('parentId') parentId: string,
  ) {
    return this.attachmentsService.list(parentType, parentId);
  }

  @Post('presign')
  presign(@Body() dto: PresignAttachmentDto, @CurrentUser() user: RequestUser) {
    return this.attachmentsService.presign(dto, user?._id);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.attachmentsService.complete(id);
  }

  @Get(':id/download')
  async download(@Param('id') id: string) {
    return this.attachmentsService.getDownloadUrl(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.attachmentsService.remove(id, user?._id);
  }
}
