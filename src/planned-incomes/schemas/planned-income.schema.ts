import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type PlannedIncomeDocument = HydratedDocument<PlannedIncome>;

@Schema({ timestamps: true })
export class PlannedIncome {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, enum: ['USD', 'NIO'] })
  currency: 'USD' | 'NIO';

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  accountId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  @Prop({ type: [Number], default: [15, 30] })
  daysOfMonth: number[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  notes?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const PlannedIncomeSchema = SchemaFactory.createForClass(PlannedIncome);
PlannedIncomeSchema.index({ accountId: 1 });
PlannedIncomeSchema.index({ isActive: 1 });
