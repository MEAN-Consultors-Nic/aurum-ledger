import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type LoanDocument = HydratedDocument<Loan>;

/**
 * Two shapes of debt, because they behave differently:
 *
 * - fixed_installment — commercial credit. A fixed amount per period, no
 *   interest, a known number of instalments and therefore a known payoff
 *   date. The whole schedule can be generated up front.
 *
 * - interest_bearing — a loan charging a rate per period on the outstanding
 *   balance, with open payments: you pay what you decide, the interest for
 *   the period is covered first and the rest reduces the capital. Nothing
 *   beyond the next payment can be known in advance.
 */
export const LOAN_KINDS = ['fixed_installment', 'interest_bearing'] as const;
export type LoanKind = (typeof LOAN_KINDS)[number];

/** monthly_days: days of the month (15, 30). interval_days: every N days from startDate. */
export const LOAN_SCHEDULE_TYPES = ['monthly_days', 'interval_days'] as const;
export type LoanScheduleType = (typeof LOAN_SCHEDULE_TYPES)[number];

export const LOAN_STATUSES = ['active', 'settled', 'cancelled'] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

@Schema({ timestamps: true })
export class Loan {
  @Prop({ required: true })
  name: string;

  @Prop({ type: String, required: true, enum: LOAN_KINDS, default: 'fixed_installment' })
  kind: LoanKind;

  /** Amount originally owed (capital borrowed, or total of a commercial credit). */
  @Prop({ required: true, min: 0 })
  principal: number;

  /** Capital still owed. Maintained from confirmed payments; never edited by hand. */
  @Prop({ required: true, min: 0, default: 0 })
  currentBalance: number;

  @Prop({ required: true, enum: ['USD', 'NIO'] })
  currency: 'USD' | 'NIO';

  @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
  accountId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Category', required: true })
  categoryId: Types.ObjectId;

  // --- schedule ---
  @Prop({ type: String, required: true, enum: LOAN_SCHEDULE_TYPES, default: 'monthly_days' })
  scheduleType: LoanScheduleType;

  /** monthly_days only. */
  @Prop({ type: [Number], default: [15, 30] })
  daysOfMonth: number[];

  /** interval_days only: 7 = weekly, 14 = fortnightly. */
  @Prop({ min: 1, max: 365 })
  intervalDays?: number;

  /** First payment date. Required for interval_days; the anchor of the series. */
  @Prop()
  startDate?: Date;

  // --- fixed_installment ---
  @Prop({ min: 0, default: 0 })
  installmentAmount: number;

  /** Total number of instalments. Empty means open-ended. */
  @Prop({ min: 1 })
  totalInstallments?: number;

  // --- interest_bearing ---
  /** Rate charged per period on the outstanding balance, in percent (4 = 4%). */
  @Prop({ min: 0, default: 0 })
  interestRatePercent: number;

  /** Interest charged but not yet paid, already capitalised into currentBalance. */
  @Prop({ min: 0, default: 0 })
  capitalizedInterest: number;

  /** Running total of interest actually paid, for the cost-of-debt reports. */
  @Prop({ min: 0, default: 0 })
  interestPaidTotal: number;

  /** Running total of capital actually repaid. */
  @Prop({ min: 0, default: 0 })
  principalPaidTotal: number;

  @Prop({ type: String, required: true, enum: LOAN_STATUSES, default: 'active' })
  status: LoanStatus;

  @Prop()
  settledAt?: Date;

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
