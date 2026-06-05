import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { AttachmentsService } from './attachments.service';
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

  /**
   * multipart/form-data: field 'file' = the binary, plus 'parentType' and
   * 'parentId' as text fields. The browser sends the file to us; we upload
   * to S3 from the server, avoiding all the presigned-PUT pitfalls.
   */
  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 25 * 1024 * 1024 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('parentType') parentType: AttachmentParentType,
    @Body('parentId') parentId: string,
    @CurrentUser() user: RequestUser,
  ) {
    if (!file) throw new BadRequestException('No file provided');
    if (!parentType || !parentId) {
      throw new BadRequestException('parentType and parentId are required');
    }
    return this.attachmentsService.upload(parentType, parentId, file, user?._id);
  }

  @Get(':id/download')
  download(@Param('id') id: string) {
    return this.attachmentsService.getDownloadUrl(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.attachmentsService.remove(id, user?._id);
  }
}
