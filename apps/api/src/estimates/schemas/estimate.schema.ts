import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EstimateDocument = HydratedDocument<Estimate>;

@Schema({ timestamps: true })
export class Estimate {
  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  serviceId: Types.ObjectId;

  @Prop()
  title?: string;

  @Prop({ required: true, enum: ['monthly', 'annual', 'one_time'] })
  billingPeriod: 'monthly' | 'annual' | 'one_time';

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ default: 'USD', enum: ['USD', 'NIO'] })
  currency: 'USD' | 'NIO';

  @Prop({ required: true, enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] })
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

  @Prop()
  notes?: string;

  @Prop()
  scope?: string;

  @Prop({ type: [String], default: [] })
  deliverables: string[];

  @Prop()
  terms?: string;

  @Prop()
  validUntil?: Date;

  @Prop()
  sentAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  sentBy?: Types.ObjectId;

  @Prop()
  conversionNotes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Contract' })
  convertedContractId?: Types.ObjectId;

  @Prop()
  convertedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  convertedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const EstimateSchema = SchemaFactory.createForClass(Estimate);
EstimateSchema.index({ clientId: 1, status: 1 });
EstimateSchema.index({ createdAt: -1 });
