import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type RecurringExpenseOccurrenceDocument = HydratedDocument<RecurringExpenseOccurrence>;

@Schema({ timestamps: true })
export class RecurringExpenseOccurrence {
  @Prop({ type: Types.ObjectId, ref: 'RecurringExpense', required: true })
  recurringExpenseId: Types.ObjectId;

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

export const RecurringExpenseOccurrenceSchema = SchemaFactory.createForClass(RecurringExpenseOccurrence);
RecurringExpenseOccurrenceSchema.index({ recurringExpenseId: 1, date: 1 }, { unique: true });
RecurringExpenseOccurrenceSchema.index({ status: 1, date: 1 });
