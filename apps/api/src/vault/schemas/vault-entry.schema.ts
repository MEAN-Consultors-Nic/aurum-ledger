import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VaultEntryDocument = HydratedDocument<VaultEntry>;

export const VAULT_CATEGORIES = [
  'personal',
  'banking',
  'email',
  'server',
  'service',
  'wifi',
  'client',
  'other',
] as const;
export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

/**
 * Generalised secrets vault. Replaces the old "Google Sheet of passwords"
 * workflow. Secrets live in `encryptedFields` (AES-256-GCM JSON blob via
 * CredentialCipher) and are NEVER returned from list endpoints — only via
 * the dedicated `/reveal` route which also writes to VaultAccessLog.
 */
@Schema({ timestamps: true })
export class VaultEntry {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ type: String, required: true, enum: VAULT_CATEGORIES, default: 'other' })
  category: VaultCategory;

  @Prop({ type: [String], default: [] })
  tags: string[];

  // Visible metadata — these are intentionally not encrypted so the list
  // grid can show them. Treat them as "shoulder-surfable" information.
  @Prop()
  url?: string;

  @Prop()
  username?: string;

  @Prop()
  notes?: string;

  // AES-256-GCM blob. JSON of arbitrary { key: value } pairs — typically
  // { password, secretKey, totpSecret, recoveryCodes, ... }.
  @Prop({ required: true })
  encryptedFields: string;

  // Optional parent — lets us tie a vault entry to a client/project/etc.
  // without forcing it (most personal entries will be orphans).
  @Prop({ type: String, enum: ['project', 'client', 'contract', 'service'], default: null })
  parentType?: 'project' | 'client' | 'contract' | 'service' | null;

  @Prop({ type: Types.ObjectId, default: null })
  parentId?: Types.ObjectId | null;

  @Prop({ default: false })
  favorite: boolean;

  @Prop()
  lastAccessedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  lastAccessedBy?: Types.ObjectId;

  @Prop({ default: 0 })
  accessCount: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const VaultEntrySchema = SchemaFactory.createForClass(VaultEntry);
VaultEntrySchema.index({ category: 1, name: 1 });
VaultEntrySchema.index({ tags: 1 });
VaultEntrySchema.index({ parentType: 1, parentId: 1 });
// Text index for the search box. Notes/url/username are useful matches.
VaultEntrySchema.index({ name: 'text', notes: 'text', url: 'text', username: 'text' });
