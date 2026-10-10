import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LoanPaymentOccurrenceDocument = HydratedDocument<LoanPaymentOccurrence>;

/**
 * One scheduled payment. For an interest-bearing loan only the next one
 * exists at any time: what comes after depends on how much is actually paid.
 */
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

  /** What is expected: the fixed instalment, or the interest due this period. */
  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, enum: ['USD', 'NIO'] })
  currency: 'USD' | 'NIO';

  @Prop({ required: true, enum: ['planned', 'confirmed', 'omitted'], default: 'planned' })
  status: 'planned' | 'confirmed' | 'omitted';

  /** Sequence number within the loan, 1-based. */
  @Prop({ min: 1 })
  sequence?: number;

  // --- interest maths, filled on confirmation ---
  @Prop({ min: 0, default: 0 })
  balanceBefore: number;

  @Prop({ min: 0, default: 0 })
  balanceAfter: number;

  /** Interest accrued for this period (rate x balanceBefore). */
  @Prop({ min: 0, default: 0 })
  interestDue: number;

  /** What was actually paid. May differ from amount on an interest-bearing loan. */
  @Prop({ min: 0 })
  paidAmount?: number;

  @Prop({ min: 0, default: 0 })
  interestPaid: number;

  @Prop({ min: 0, default: 0 })
  principalPaid: number;

  /** Interest left unpaid and added to the balance. */
  @Prop({ min: 0, default: 0 })
  interestCapitalized: number;

  @Prop()
  note?: string;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  confirmedTransactionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const LoanPaymentOccurrenceSchema = SchemaFactory.createForClass(LoanPaymentOccurrence);
LoanPaymentOccurrenceSchema.index({ loanId: 1, date: 1 });
