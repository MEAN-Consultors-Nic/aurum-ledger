import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NetWorthSnapshotDocument = HydratedDocument<NetWorthSnapshot>;

@Schema({ timestamps: true })
export class NetWorthSnapshot {
  /** UTC date key in YYYY-MM-DD form; one snapshot per day. */
  @Prop({ required: true, unique: true })
  dateKey: string;

  @Prop({ required: true })
  date: Date;

  // ----- Composition by currency (native amounts) -----
  @Prop({ default: 0 }) cashUsd: number;
  @Prop({ default: 0 }) cashNio: number;
  @Prop({ default: 0 }) assetsUsd: number;
  @Prop({ default: 0 }) assetsNio: number;
  @Prop({ default: 0 }) debtsUsd: number;
  @Prop({ default: 0 }) debtsNio: number;

  // ----- Aggregates -----
  /** USD→NIO rate used to convert NIO to USD for the total. */
  @Prop({ required: true })
  fxRate: number;

  /** Net worth in USD using the FX rate above. */
  @Prop({ required: true })
  netWorthUsd: number;

  /** Net worth held natively in USD (no conversion). */
  @Prop({ default: 0 })
  netWorthNativeUsd: number;

  /** Net worth held natively in NIO. */
  @Prop({ default: 0 })
  netWorthNativeNio: number;
}

export const NetWorthSnapshotSchema = SchemaFactory.createForClass(NetWorthSnapshot);
NetWorthSnapshotSchema.index({ dateKey: 1 }, { unique: true });
NetWorthSnapshotSchema.index({ date: 1 });
