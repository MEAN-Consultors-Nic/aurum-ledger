import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PaymentDocument = HydratedDocument<Payment>;

@Schema({ timestamps: true })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'Contract', required: true })
  contractId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  accountId: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ default: 0, min: 0 })
  retentionAmount?: number;

  @Prop({ required: true, enum: ['USD', 'NIO'], default: 'USD' })
  currency: 'USD' | 'NIO';

  @Prop({ required: true, min: 0.0001, default: 1 })
  exchangeRate: number;

  @Prop({ default: 0, min: 0 })
  appliedAmount?: number;

  @Prop({ required: true })
  paymentDate: Date;

  @Prop({
    required: true,
    enum: ['cash', 'bank', 'card', 'transfer', 'other'],
  })
  method: 'cash' | 'bank' | 'card' | 'transfer' | 'other';

  @Prop()
  reference?: string;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;
}

export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ contractId: 1 });
PaymentSchema.index({ clientId: 1 });
PaymentSchema.index({ accountId: 1 });
PaymentSchema.index({ paymentDate: -1 });
