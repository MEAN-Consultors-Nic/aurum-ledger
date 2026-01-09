import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PlannedIncomeOccurrenceDocument = HydratedDocument<PlannedIncomeOccurrence>;

@Schema({ timestamps: true })
export class PlannedIncomeOccurrence {
  @Prop({ type: Types.ObjectId, ref: 'PlannedIncome', required: true })
  plannedIncomeId: Types.ObjectId;

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

  @Prop({ min: 0 })
  receivedAmount?: number;

  @Prop({ min: 0 })
  feeAmount?: number;

  @Prop()
  confirmationNote?: string;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  confirmedTransactionId?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const PlannedIncomeOccurrenceSchema = SchemaFactory.createForClass(PlannedIncomeOccurrence);
PlannedIncomeOccurrenceSchema.index({ plannedIncomeId: 1, date: 1 }, { unique: true });
PlannedIncomeOccurrenceSchema.index({ status: 1, date: 1 });
