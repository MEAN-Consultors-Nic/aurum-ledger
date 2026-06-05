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
    const items = await this.attachmentModel
      .find({
        parentType,
        parentId: new Types.ObjectId(parentId),
        status: 'uploaded',
        deletedAt: { $exists: false },
      })
      .populate('uploadedBy', 'name email')
      .sort({ uploadedAt: -1 });

    // For images, attach a 1-hour signed GET URL so the panel can render
    // inline thumbnails without N round-trips. Bucket stays private — every
    // URL is short-lived and signed per-request.
    return Promise.all(
      items.map(async (doc) => {
        const obj = doc.toObject() as unknown as Record<string, unknown>;
        const mimeType = obj['mimeType'];
        const s3Key = obj['s3Key'];
        if (
          typeof mimeType === 'string' &&
          mimeType.startsWith('image/') &&
          typeof s3Key === 'string'
        ) {
          try {
            obj['previewUrl'] = await this.s3Service.presignDownload(s3Key);
          } catch {
            // Best-effort — if signing fails we still show the row, just no thumb.
          }
        }
        return obj;
      }),
    );
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
    const folder = this.folderForParent(parentType);
    const key = `${folder}/${parentId}/${this.uniqueSegment()}-${safeName}`;
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

  /** Maps the parent type to a human-friendly bucket folder. Pluralized so
   *  AWS Console browsing actually reads well. */
  private folderForParent(parentType: AttachmentParentType): string {
    switch (parentType) {
      case 'project':
        return 'projects';
      case 'estimate':
        return 'estimates';
      case 'contract':
        return 'contracts';
      case 'task':
        return 'tasks';
      case 'client':
        return 'clients';
    }
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
