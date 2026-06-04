import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type NotificationRuleDocument = HydratedDocument<NotificationRule>;

export type RecipientExpression =
  | 'project.assignedTo'
  | 'contract.client'
  | 'admin'
  | `custom:${string}`;

@Schema({ timestamps: true })
export class NotificationRule {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  eventKey: string;

  @Prop({ type: Types.ObjectId, ref: 'NotificationTemplate', required: true })
  templateId: Types.ObjectId;

  // Recipients are expressions resolved at send time. e.g.
  // ['project.assignedTo', 'contract.client', 'custom:billing@x.com']
  @Prop({ type: [String], default: [] })
  recipients: string[];

  // Conditions, e.g. { daysBeforeDue: 30, currency: 'USD', minAmount: 100 }
  @Prop({ type: Object, default: {} })
  conditions: Record<string, unknown>;

  @Prop({ default: true })
  enabled: boolean;

  @Prop()
  lastTriggeredAt?: Date;

  @Prop({ default: false })
  isSystem: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const NotificationRuleSchema = SchemaFactory.createForClass(NotificationRule);
NotificationRuleSchema.index({ eventKey: 1, enabled: 1 });
