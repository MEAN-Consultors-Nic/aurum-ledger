import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EstimateDocument = HydratedDocument<Estimate>;

@Schema({ timestamps: true })
export class Estimate {
  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service', required: true })
  serviceId: Types.ObjectId;

  @Prop()
  title?: string;

  @Prop({ required: true, enum: ['monthly', 'annual', 'one_time'] })
  billingPeriod: 'monthly' | 'annual' | 'one_time';

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ default: 'USD', enum: ['USD', 'NIO'] })
  currency: 'USD' | 'NIO';

  @Prop({ required: true, enum: ['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'] })
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

  @Prop()
  notes?: string;

  @Prop()
  scope?: string;

  @Prop({ type: [String], default: [] })
  deliverables: string[];

  @Prop()
  terms?: string;

  @Prop()
  validUntil?: Date;

  @Prop()
  sentAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  sentBy?: Types.ObjectId;

  @Prop()
  conversionNotes?: string;

  @Prop({ type: Types.ObjectId, ref: 'Contract' })
  convertedContractId?: Types.ObjectId;

  @Prop()
  convertedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  convertedBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;

  /** User-defined custom field values keyed by definition.key. */
  @Prop({ type: Object, default: {} })
  customValues: Record<string, unknown>;

  // ----- Client-portal share link -----
  @Prop()
  shareToken?: string;

  @Prop()
  shareCreatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  shareCreatedBy?: Types.ObjectId;

  @Prop()
  shareRevokedAt?: Date;

  @Prop({ default: 0 })
  shareViewCount: number;

  @Prop()
  shareLastViewedAt?: Date;

  /**
   * Salted scrypt hash of the link's 6-digit PIN (see share-link.ts). Never
   * selected by default and never returned: a 6-digit PIN is trivial to
   * brute-force from its hash.
   */
  @Prop({ select: false })
  sharePinHash?: string;

  /** Wrong PINs on the current link; MAX_PIN_ATTEMPTS locks it. */
  @Prop({ default: 0 })
  shareFailedAttempts: number;

  /** Set when the link was locked by wrong PINs; only a new link reopens it. */
  @Prop()
  shareLockedAt?: Date;

  // ----- The client's answer through the link -----
  @Prop({ enum: ['accepted', 'declined'] })
  clientDecision?: 'accepted' | 'declined';

  @Prop()
  clientDecisionAt?: Date;

  /** Accept: the full name the client typed as signature. */
  @Prop()
  clientDecisionName?: string;

  /** Decline: the optional reason the client gave. */
  @Prop()
  clientDecisionReason?: string;

  @Prop()
  clientDecisionIp?: string;

  @Prop()
  clientDecisionUserAgent?: string;

  /** Accept: the client ticked "I accept the terms". */
  @Prop()
  clientAcceptedTerms?: boolean;

  /**
   * What the client saw when they answered (title, amount, currency,
   * billing period), so the record holds even if the estimate is edited later.
   */
  @Prop({ type: Object })
  clientDecisionSnapshot?: {
    title?: string;
    amount: number;
    currency: string;
    billingPeriod: string;
  };
}

export const EstimateSchema = SchemaFactory.createForClass(Estimate);
EstimateSchema.index({ clientId: 1, status: 1 });
EstimateSchema.index({ createdAt: -1 });
EstimateSchema.index({ shareToken: 1 }, { unique: true, sparse: true });
