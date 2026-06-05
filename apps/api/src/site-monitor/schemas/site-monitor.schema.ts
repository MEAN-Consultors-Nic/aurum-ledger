import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SiteMonitorDocument = HydratedDocument<SiteMonitor>;

@Schema({ timestamps: true })
export class SiteMonitor {
  @Prop({ required: true, trim: true })
  name: string;

  /** Full URL with protocol — https://example.com */
  @Prop({ required: true, trim: true })
  url: string;

  /** Optional link to a project so we can surface alerts in context. */
  @Prop({ type: Types.ObjectId, ref: 'Project' })
  projectId?: Types.ObjectId;

  @Prop({ default: true })
  isActive: boolean;

  // ----- Last HTTP check result -----
  @Prop()
  lastCheckedAt?: Date;

  @Prop()
  lastHttpStatus?: number;

  @Prop()
  lastResponseMs?: number;

  @Prop({ default: true })
  isUp: boolean;

  @Prop()
  lastDownAt?: Date;

  @Prop()
  lastErrorMessage?: string;

  // ----- SSL -----
  @Prop()
  sslExpiresAt?: Date;

  @Prop()
  sslIssuer?: string;

  @Prop()
  sslCheckedAt?: Date;

  /** Days-before-expiry threshold to flag SSL as 'warning'. */
  @Prop({ default: 30 })
  sslWarnDays: number;

  // ----- Domain (manual entry; user updates yearly) -----
  @Prop()
  domainExpiresAt?: Date;

  @Prop({ default: 30 })
  domainWarnDays: number;

  // ----- Audit -----
  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const SiteMonitorSchema = SchemaFactory.createForClass(SiteMonitor);
SiteMonitorSchema.index({ deletedAt: 1, isActive: 1 });
SiteMonitorSchema.index({ projectId: 1 });
