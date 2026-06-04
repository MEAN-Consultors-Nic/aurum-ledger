import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LoanPaymentOccurrenceDocument = HydratedDocument<LoanPaymentOccurrence>;

@Schema({ timestamps: true })
export class LoanPaymentOccurrence {
  @Prop({ type: Types.ObjectId, ref: 'Loan', required: true })
  loanId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  accountId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, enum: ['USD', 'NIO'] })
  currency: 'USD' | 'NIO';

  @Prop({ required: true, enum: ['planned', 'confirmed', 'omitted'], default: 'planned' })
  status: 'planned' | 'confirmed' | 'omitted';

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  confirmedTransactionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const LoanPaymentOccurrenceSchema = SchemaFactory.createForClass(LoanPaymentOccurrence);
LoanPaymentOccurrenceSchema.index({ loanId: 1, date: 1 }, { unique: true });
LoanPaymentOccurrenceSchema.index({ status: 1, date: 1 });
