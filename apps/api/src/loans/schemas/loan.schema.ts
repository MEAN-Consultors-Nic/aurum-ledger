import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LoanDocument = HydratedDocument<Loan>;

@Schema({ timestamps: true })
export class Loan {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, min: 0 })
  principal: number;

  @Prop({ required: true, min: 0 })
  installmentAmount: number;

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

export const LoanSchema = SchemaFactory.createForClass(Loan);
LoanSchema.index({ accountId: 1 });
LoanSchema.index({ isActive: 1 });
