import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SettingsModule } from '../settings/settings.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { S3Service } from './s3.service';
import { Attachment, AttachmentSchema } from './schemas/attachment.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Attachment.name, schema: AttachmentSchema }]),
    SettingsModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, S3Service],
  exports: [AttachmentsService, S3Service],
})
export class AttachmentsModule {}
