import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ required: true, enum: ['income', 'expense', 'transfer', 'adjustment'] })
  type: 'income' | 'expense' | 'transfer' | 'adjustment';

  @Prop({ required: true, enum: ['in', 'out'] })
  flow: 'in' | 'out';

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  accountId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account' })
  toAccountId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId?: Types.ObjectId;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, enum: ['USD', 'NIO'] })
  currency: 'USD' | 'NIO';

  @Prop()
  exchangeRate?: number;

  @Prop({ required: true })
  date: Date;

  @Prop()
  reference?: string;

  @Prop()
  notes?: string;

  @Prop()
  voidedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  voidedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId })
  transferGroupId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  linkedPaymentId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Contract' })
  linkedContractId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client' })
  linkedClientId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
TransactionSchema.index({ accountId: 1, date: -1 });
TransactionSchema.index({ linkedClientId: 1 });
TransactionSchema.index({ linkedContractId: 1 });
