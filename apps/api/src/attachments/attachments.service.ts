import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { S3Service } from './s3.service';
import {
  Attachment,
  AttachmentDocument,
  AttachmentParentType,
} from './schemas/attachment.schema';

const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB per file

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectModel(Attachment.name)
    private readonly attachmentModel: Model<AttachmentDocument>,
    private readonly s3Service: S3Service,
  ) {}

  async list(parentType: AttachmentParentType, parentId: string) {
    return this.attachmentModel
      .find({
        parentType,
        parentId: new Types.ObjectId(parentId),
        status: 'uploaded',
        deletedAt: { $exists: false },
      })
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 });
  }

  /**
   * Server-side upload. Receives the multer file from the controller, pushes
   * to S3 with credentials, then writes the Attachment row in one shot.
   */
  async upload(
    parentType: AttachmentParentType,
    parentId: string,
    file: Express.Multer.File,
    userId?: Types.ObjectId,
  ) {
    if (!file?.buffer || file.size === 0) {
      throw new BadRequestException('Empty upload');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large (max ${MAX_SIZE_BYTES / 1024 / 1024} MB)`,
      );
    }

    const safeName = this.sanitizeFilename(file.originalname);
    const key = `${parentType}/${parentId}/${this.uniqueSegment()}-${safeName}`;
    const contentType = file.mimetype || 'application/octet-stream';

    const { bucket } = await this.s3Service.uploadObject(key, file.buffer, contentType);

    return this.attachmentModel.create({
      filename: file.originalname,
      mimeType: contentType,
      sizeBytes: file.size,
      s3Key: key,
      s3Bucket: bucket,
      parentType,
      parentId: new Types.ObjectId(parentId),
      status: 'uploaded',
      uploadedAt: new Date(),
      uploadedBy: userId,
    });
  }

  async getDownloadUrl(attachmentId: string) {
    const attachment = await this.attachmentModel.findOne({
      _id: attachmentId,
      deletedAt: { $exists: false },
      status: 'uploaded',
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    const url = await this.s3Service.presignDownload(attachment.s3Key, attachment.filename);
    return { url, filename: attachment.filename, mimeType: attachment.mimeType };
  }

  async remove(attachmentId: string, userId?: Types.ObjectId) {
    const attachment = await this.attachmentModel.findOne({
      _id: attachmentId,
      deletedAt: { $exists: false },
    });
    if (!attachment) throw new NotFoundException('Attachment not found');
    attachment.deletedAt = new Date();
    await attachment.save();
    await this.s3Service.deleteObject(attachment.s3Key);
    return { deleted: true };
  }

  private sanitizeFilename(name: string): string {
    return name
      .replace(/\\/g, '/')
      .split('/')
      .pop()!
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 120);
  }

  private uniqueSegment(): string {
    return randomBytes(8).toString('hex');
  }
}
