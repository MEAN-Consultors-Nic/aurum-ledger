import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VaultAccessLogDocument = HydratedDocument<VaultAccessLog>;

export const VAULT_ACCESS_ACTIONS = ['view', 'create', 'update', 'delete'] as const;
export type VaultAccessAction = (typeof VAULT_ACCESS_ACTIONS)[number];

/**
 * One row per access. `view` rows are written by the /reveal endpoint and
 * are the security-sensitive ones — they prove who saw which secret when.
 */
@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class VaultAccessLog {
  @Prop({ type: Types.ObjectId, ref: 'VaultEntry', required: true, index: true })
  entryId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  userId?: Types.ObjectId;

  @Prop({ required: true, enum: VAULT_ACCESS_ACTIONS })
  action: VaultAccessAction;

  @Prop()
  ip?: string;

  @Prop()
  userAgent?: string;
}

export const VaultAccessLogSchema = SchemaFactory.createForClass(VaultAccessLog);
VaultAccessLogSchema.index({ entryId: 1, createdAt: -1 });
