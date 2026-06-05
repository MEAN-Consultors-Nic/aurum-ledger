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

export type PresignInput = {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  parentType: AttachmentParentType;
  parentId: string;
};

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

  async presign(input: PresignInput, userId?: Types.ObjectId) {
    if (!input.filename?.trim()) {
      throw new BadRequestException('filename required');
    }
    if (input.sizeBytes <= 0) {
      throw new BadRequestException('sizeBytes must be > 0');
    }
    if (input.sizeBytes > MAX_SIZE_BYTES) {
      throw new BadRequestException(`File too large (max ${MAX_SIZE_BYTES / 1024 / 1024} MB)`);
    }

    const bucket = await this.s3Service.bucketName();
    const safeName = this.sanitizeFilename(input.filename);
    const key = `${input.parentType}/${input.parentId}/${this.uniqueSegment()}-${safeName}`;

    // Reserve the row first — if upload never completes, status stays 'pending'
    // and the record is cleaned up out-of-band later (or just sits harmless).
    const attachment = await this.attachmentModel.create({
      filename: input.filename,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      s3Key: key,
      s3Bucket: bucket,
      parentType: input.parentType,
      parentId: new Types.ObjectId(input.parentId),
      status: 'pending',
      uploadedBy: userId,
    });

    const uploadUrl = await this.s3Service.presignUpload(key, input.mimeType);
    return {
      attachmentId: attachment._id.toString(),
      uploadUrl,
      method: 'PUT' as const,
      headers: { 'Content-Type': input.mimeType },
      s3Key: key,
    };
  }

  /** Called by the client after the S3 PUT succeeded. */
  async complete(attachmentId: string) {
    const attachment = await this.attachmentModel.findOneAndUpdate(
      { _id: attachmentId, deletedAt: { $exists: false }, status: 'pending' },
      { status: 'uploaded', uploadedAt: new Date() },
      { new: true },
    );
    if (!attachment) {
      throw new NotFoundException('Attachment not found or already completed');
    }
    return attachment;
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
    // Best-effort: drop the object from S3 too.
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
