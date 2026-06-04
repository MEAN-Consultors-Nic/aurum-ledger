import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationLogDocument = HydratedDocument<NotificationLog>;

@Schema({ timestamps: true })
export class NotificationLog {
  @Prop()
  eventKey?: string;

  @Prop({ type: Types.ObjectId, ref: 'NotificationRule' })
  ruleId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'NotificationTemplate' })
  templateId?: Types.ObjectId;

  @Prop()
  contextRef?: string; // arbitrary identifier (e.g. "contract:abc123")

  @Prop({ required: true })
  recipient: string;

  @Prop({ required: true })
  subject: string;

  @Prop()
  bodyHtml?: string;

  @Prop({ required: true, enum: ['queued', 'sent', 'failed', 'skipped'], default: 'queued' })
  status: 'queued' | 'sent' | 'failed' | 'skipped';

  @Prop()
  error?: string;

  @Prop()
  sentAt?: Date;

  // Used to prevent re-sending the same logical trigger within a window.
  @Prop()
  dedupeKey?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  triggeredBy?: Types.ObjectId;
}

export const NotificationLogSchema = SchemaFactory.createForClass(NotificationLog);
NotificationLogSchema.index({ dedupeKey: 1 });
NotificationLogSchema.index({ eventKey: 1, createdAt: -1 });
NotificationLogSchema.index({ contextRef: 1, createdAt: -1 });
