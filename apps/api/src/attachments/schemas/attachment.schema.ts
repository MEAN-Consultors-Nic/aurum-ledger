import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AttachmentDocument = HydratedDocument<Attachment>;

export type AttachmentParentType =
  | 'estimate'
  | 'contract'
  | 'project'
  | 'task'
  | 'client';

@Schema({ timestamps: true })
export class Attachment {
  @Prop({ required: true, trim: true })
  filename: string;

  @Prop({ required: true })
  mimeType: string;

  @Prop({ required: true })
  sizeBytes: number;

  /** Object key inside the bucket. */
  @Prop({ required: true })
  s3Key: string;

  /** Bucket name at upload time — pinned so re-config doesn't lose files. */
  @Prop({ required: true })
  s3Bucket: string;

  @Prop({ required: true, enum: ['estimate', 'contract', 'project', 'task', 'client'] })
  parentType: AttachmentParentType;

  @Prop({ required: true, type: Types.ObjectId })
  parentId: Types.ObjectId;

  /** 'pending' = presigned but client hasn't confirmed; 'uploaded' = visible. */
  @Prop({ required: true, enum: ['pending', 'uploaded'], default: 'pending' })
  status: 'pending' | 'uploaded';

  @Prop({ type: Types.ObjectId, ref: 'User' })
  uploadedBy?: Types.ObjectId;

  @Prop()
  uploadedAt?: Date;

  @Prop()
  deletedAt?: Date;
}

export const AttachmentSchema = SchemaFactory.createForClass(Attachment);
AttachmentSchema.index({ parentType: 1, parentId: 1, deletedAt: 1 });
AttachmentSchema.index({ s3Key: 1 });
