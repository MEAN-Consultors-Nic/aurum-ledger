import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type AssetDocument = HydratedDocument<Asset>;

export type AssetType =
  | 'real_estate'
  | 'vehicle'
  | 'investment'
  | 'retirement'
  | 'crypto'
  | 'cash_equivalent'
  | 'receivable'
  | 'other';

@Schema({ timestamps: true })
export class Asset {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({
    required: true,
    enum: [
      'real_estate',
      'vehicle',
      'investment',
      'retirement',
      'crypto',
      'cash_equivalent',
      'receivable',
      'other',
    ],
    default: 'other',
  })
  type: AssetType;

  @Prop({ required: true, enum: ['USD', 'NIO'], default: 'USD' })
  currency: 'USD' | 'NIO';

  @Prop({ required: true, default: 0 })
  currentValue: number;

  @Prop()
  notes?: string;

  @Prop()
  lastValuationAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);
AssetSchema.index({ deletedAt: 1, type: 1 });
