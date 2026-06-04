import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationTemplateDocument = HydratedDocument<NotificationTemplate>;

@Schema({ timestamps: true })
export class NotificationTemplate {
  @Prop({ type: Types.ObjectId, ref: 'TemplateGroup' })
  groupId?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: ['email'], default: 'email' })
  channel: 'email';

  @Prop()
  eventKey?: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  bodyHtml: string;

  @Prop()
  bodyText?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ default: false })
  isSystem: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const NotificationTemplateSchema = SchemaFactory.createForClass(NotificationTemplate);
NotificationTemplateSchema.index({ groupId: 1 });
NotificationTemplateSchema.index({ eventKey: 1 });
