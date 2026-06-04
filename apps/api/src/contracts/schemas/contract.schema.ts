import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ContractDocument = HydratedDocument<Contract>;

@Schema({ timestamps: true })
export class Contract {
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

  @Prop({ required: true })
  startDate: Date;

  @Prop()
  endDate?: Date;

  @Prop({ required: true, enum: ['active', 'expired', 'cancelled'], default: 'active' })
  status: 'active' | 'expired' | 'cancelled';

  @Prop()
  notes?: string;

  @Prop({ default: 0 })
  paidTotal: number;

  @Prop({ default: 0 })
  paymentCount: number;

  @Prop()
  lastPaymentDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;

  @Prop()
  paymentOmittedAt?: Date;

  @Prop()
  paymentOmissionNote?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  paymentOmittedBy?: Types.ObjectId;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);
ContractSchema.index({ clientId: 1 });
ContractSchema.index({ endDate: 1, status: 1 });
