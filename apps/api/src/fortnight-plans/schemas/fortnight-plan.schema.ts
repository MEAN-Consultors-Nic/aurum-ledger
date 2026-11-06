import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export const LINE_KINDS = ['income', 'expense', 'savings'] as const;
export type LineKind = (typeof LINE_KINDS)[number];

/** Where a line comes from. Anything but `manual` mirrors an occurrence of another module. */
export const LINE_SOURCES = [
  'manual',
  'loan',
  'recurring_expense',
  'subscription',
  'planned_income',
] as const;
export type LineSource = (typeof LINE_SOURCES)[number];

/**
 * planned  — waiting to happen.
 * applying — claimed by an apply in flight; the claim is what makes a double
 *            click (or two tabs) unable to move money twice.
 * applied  — executed; carries the transaction it produced.
 * skipped  — will not happen this fortnight.
 * carried  — moved to the next fortnight (a copy lives there).
 */
export const LINE_STATUSES = [
  'planned',
  'applying',
  'applied',
  'skipped',
  'carried',
] as const;
export type LineStatus = (typeof LINE_STATUSES)[number];

export type Currency = 'USD' | 'NIO';

@Schema({ _id: true, timestamps: false })
export class FortnightPlanLine {
  _id: Types.ObjectId;

  @Prop({ type: String, required: true, enum: LINE_KINDS })
  kind: LineKind;

  @Prop({ type: String, required: true, enum: LINE_SOURCES, default: 'manual' })
  source: LineSource;

  /** The loan / recurring expense / subscription / planned income behind the line. */
  @Prop({ type: Types.ObjectId })
  sourceId?: Types.ObjectId;

  /** The exact occurrence this line mirrors. */
  @Prop({ type: Types.ObjectId })
  sourceOccurrenceId?: Types.ObjectId;

  @Prop({ type: String, required: true, trim: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: 'Category' })
  categoryId?: Types.ObjectId;

  /** Account the money leaves (expense, savings) or lands in (income). */
  @Prop({ type: Types.ObjectId, ref: 'Account' })
  accountId?: Types.ObjectId;

  /** savings only: where the money is set aside. */
  @Prop({ type: Types.ObjectId, ref: 'Account' })
  toAccountId?: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 0 })
  plannedAmount: number;

  /** Currency of the obligation itself (a córdoba debt stays in córdobas). */
  @Prop({ type: String, required: true, enum: ['USD', 'NIO'] })
  currency: Currency;

  /** The user changed the planned amount, so sync must not overwrite it. */
  @Prop({ type: Boolean, default: false })
  amountOverridden: boolean;

  @Prop({ type: Date })
  dueDate?: Date;

  @Prop({
    type: String,
    required: true,
    enum: LINE_STATUSES,
    default: 'planned',
  })
  status: LineStatus;

  @Prop({ type: Date })
  applyStartedAt?: Date;

  /** What was actually executed, in the line's currency. */
  @Prop({ type: Number, min: 0 })
  appliedAmount?: number;

  /** What actually left/entered the account, in the account's currency. */
  @Prop({ type: Number, min: 0 })
  appliedAccountAmount?: number;

  @Prop({ type: String, enum: ['USD', 'NIO'] })
  appliedAccountCurrency?: Currency;

  @Prop({ type: Number, min: 0 })
  appliedExchangeRate?: number;

  @Prop({ type: Date })
  appliedDate?: Date;

  @Prop({ type: Date })
  appliedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'Transaction' })
  transactionId?: Types.ObjectId;

  @Prop({ type: String })
  note?: string;

  /** Set when the user included a line its module had omitted; sync must not leave it out again. */
  @Prop({ type: Boolean })
  includedByUser?: boolean;

  /** manual lines: copy into the next fortnight when it is opened. */
  @Prop({ type: Boolean, default: false })
  repeat: boolean;

  /** Recorded from the planner as spending that was never planned. */
  @Prop({ type: Boolean, default: false })
  unplanned: boolean;

  @Prop({ type: String })
  carriedFromPeriod?: string;

  @Prop({ type: String })
  carriedToPeriod?: string;

  /** Set when the line became a recurring expense template. */
  @Prop({ type: Types.ObjectId })
  promotedToRecurringId?: Types.ObjectId;

  /** Small read-only facts about the source (loan kind, balance…) for display. */
  @Prop({ type: Object })
  meta?: Record<string, unknown>;

  @Prop({ type: Number, default: 0 })
  order: number;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const FortnightPlanLineSchema =
  SchemaFactory.createForClass(FortnightPlanLine);

export type FortnightPlanDocument = HydratedDocument<FortnightPlan>;

@Schema({ timestamps: true })
export class FortnightPlan {
  /** "YYYY-MM-1" (1st–15th) or "YYYY-MM-2" (16th–end). */
  @Prop({ type: String, required: true })
  periodKey: string;

  @Prop({ type: Date, required: true })
  startDate: Date;

  @Prop({ type: Date, required: true })
  endDate: Date;

  @Prop({
    type: String,
    required: true,
    enum: ['open', 'closed'],
    default: 'open',
  })
  status: 'open' | 'closed';

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: [FortnightPlanLineSchema], default: [] })
  lines: FortnightPlanLine[];

  @Prop({ type: Date })
  lastSyncedAt?: Date;

  /** Set when the planning wizard was completed; until then the plan is a draft. */
  @Prop({ type: Date })
  plannedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  plannedBy?: Types.ObjectId;

  @Prop({ type: Date })
  closedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  closedBy?: Types.ObjectId;

  /** Frozen summary taken at close, so history does not drift with later edits or FX. */
  @Prop({ type: Object })
  closingSummary?: Record<string, unknown>;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;
}

export const FortnightPlanSchema = SchemaFactory.createForClass(FortnightPlan);
FortnightPlanSchema.index({ periodKey: 1 }, { unique: true });
FortnightPlanSchema.index({ startDate: -1 });
FortnightPlanSchema.index({ 'lines.sourceOccurrenceId': 1 });
FortnightPlanSchema.index({ status: 1, 'lines.status': 1 });
