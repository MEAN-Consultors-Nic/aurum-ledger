import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { LoansService } from '../loans/loans.service';
import {
  LoanPaymentOccurrence,
  LoanPaymentOccurrenceDocument,
} from '../loans/schemas/loan-payment-occurrence.schema';
import { PlannedIncomesService } from '../planned-incomes/planned-incomes.service';
import {
  PlannedIncomeOccurrence,
  PlannedIncomeOccurrenceDocument,
} from '../planned-incomes/schemas/planned-income-occurrence.schema';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import {
  RecurringExpenseOccurrence,
  RecurringExpenseOccurrenceDocument,
} from '../recurring-expenses/schemas/recurring-expense-occurrence.schema';
import {
  SubscriptionOccurrence,
  SubscriptionOccurrenceDocument,
} from '../subscriptions/schemas/subscription-occurrence.schema';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { FortnightPeriod, monthKey } from './fortnight-period';
import { Currency, LineSource } from './schemas/fortnight-plan.schema';

export type ExternalSource = Exclude<LineSource, 'manual'>;

/** One occurrence of any scheduling module, in a single shape. */
export type SourceOccurrence = {
  source: ExternalSource;
  occurrenceId: Types.ObjectId;
  sourceId: Types.ObjectId;
  name: string;
  kind: 'income' | 'expense';
  amount: number;
  currency: Currency;
  date: Date;
  status: 'planned' | 'confirmed' | 'omitted';
  accountId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  paidAmount?: number;
  accountAmount?: number;
  accountCurrency?: Currency;
  exchangeRate?: number;
  transactionId?: Types.ObjectId;
  /** The template behind it is switched off: its pending occurrences are not real plans. */
  templateInactive: boolean;
  meta?: Record<string, unknown>;
};

export type ConfirmResult = {
  transactionId?: Types.ObjectId;
  accountAmount?: number;
  accountCurrency?: Currency;
  exchangeRate?: number;
};

type Ref = {
  _id: Types.ObjectId;
  name?: string;
  isActive?: boolean;
  [key: string]: unknown;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** How far back a still-unpaid occurrence is pulled into the current fortnight as overdue. */
export const OVERDUE_LOOKBACK_DAYS = 120;

/**
 * The planner never re-implements what loans, recurring expenses,
 * subscriptions and planned incomes already do. This adapter reads their
 * occurrences and hands confirmations back to their own services, so every
 * business rule (amortisation, FX, fees) stays where it lives.
 */
@Injectable()
export class FortnightSourcesService {
  constructor(
    @InjectModel(LoanPaymentOccurrence.name)
    private readonly loanOccurrenceModel: Model<LoanPaymentOccurrenceDocument>,
    @InjectModel(RecurringExpenseOccurrence.name)
    private readonly recurringOccurrenceModel: Model<RecurringExpenseOccurrenceDocument>,
    @InjectModel(SubscriptionOccurrence.name)
    private readonly subscriptionOccurrenceModel: Model<SubscriptionOccurrenceDocument>,
    @InjectModel(PlannedIncomeOccurrence.name)
    private readonly incomeOccurrenceModel: Model<PlannedIncomeOccurrenceDocument>,
    private readonly loansService: LoansService,
    private readonly recurringExpensesService: RecurringExpensesService,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly plannedIncomesService: PlannedIncomesService,
  ) {}

  /**
   * Recurring expenses, subscriptions and planned incomes create their
   * occurrences lazily, month by month, when the month is listed. Do the same
   * so a fortnight never misses a charge just because nobody opened that
   * month's screen yet.
   */
  async generate(period: FortnightPeriod) {
    const month = monthKey(period);
    await this.recurringExpensesService.listOccurrences(month);
    await this.subscriptionsService.listOccurrences(month);
    await this.plannedIncomesService.listOccurrences(month);
  }

  /**
   * Every occurrence inside the window, every still-unpaid one from the
   * recent past (it is overdue, so it belongs to the fortnight where it will
   * finally be paid), and any occurrence the plan already references.
   */
  async fetch(
    period: FortnightPeriod,
    knownIds: Types.ObjectId[],
  ): Promise<SourceOccurrence[]> {
    const lookbackStart = new Date(
      period.start.getTime() - OVERDUE_LOOKBACK_DAYS * DAY_MS,
    );
    const or: Record<string, unknown>[] = [
      { date: { $gte: period.start, $lte: period.end } },
      { status: 'planned', date: { $gte: lookbackStart, $lt: period.start } },
    ];
    if (knownIds.length > 0) {
      or.push({ _id: { $in: knownIds } });
    }
    const filter = { $or: or };

    const [loans, recurring, subscriptions, incomes] = await Promise.all([
      this.loanOccurrenceModel
        .find(filter)
        .populate(
          'loanId',
          'name kind currentBalance interestRatePercent status isActive',
        )
        .lean(),
      this.recurringOccurrenceModel
        .find(filter)
        .populate('recurringExpenseId', 'name isActive')
        .lean(),
      this.subscriptionOccurrenceModel
        .find(filter)
        .populate('subscriptionId', 'name isActive')
        .lean(),
      this.incomeOccurrenceModel
        .find(filter)
        .populate('plannedIncomeId', 'name isActive')
        .lean(),
    ]);

    const result: SourceOccurrence[] = [];

    for (const occ of loans) {
      const loan = occ.loanId as unknown as Ref | null;
      if (!loan) continue;
      result.push({
        source: 'loan',
        occurrenceId: occ._id,
        sourceId: loan._id,
        name: loan.name ?? 'Loan payment',
        kind: 'expense',
        amount: occ.amount,
        currency: occ.currency,
        date: occ.date,
        status: occ.status,
        accountId: occ.accountId,
        categoryId: occ.categoryId,
        paidAmount: occ.paidAmount,
        accountAmount: occ.accountAmount,
        accountCurrency: occ.accountCurrency,
        exchangeRate: occ.exchangeRate,
        transactionId: occ.confirmedTransactionId,
        templateInactive: loan.status !== undefined && loan.status !== 'active',
        meta: {
          loanKind: loan.kind,
          loanBalance: loan.currentBalance,
          interestRatePercent: loan.interestRatePercent,
          sequence: occ.sequence,
        },
      });
    }

    for (const occ of recurring) {
      const template = occ.recurringExpenseId as unknown as Ref | null;
      if (!template) continue;
      result.push({
        source: 'recurring_expense',
        occurrenceId: occ._id,
        sourceId: template._id,
        name: template.name ?? 'Recurring expense',
        kind: 'expense',
        amount: occ.amount,
        currency: occ.currency,
        date: occ.date,
        status: occ.status,
        accountId: occ.accountId,
        categoryId: occ.categoryId,
        paidAmount:
          occ.paidAmount ??
          (occ.status === 'confirmed' ? occ.amount : undefined),
        accountAmount: occ.paidAmount ?? occ.amount,
        accountCurrency: occ.currency,
        transactionId: occ.confirmedTransactionId,
        templateInactive: template.isActive === false,
      });
    }

    for (const occ of subscriptions) {
      const template = occ.subscriptionId as unknown as Ref | null;
      if (!template) continue;
      result.push({
        source: 'subscription',
        occurrenceId: occ._id,
        sourceId: template._id,
        name: template.name ?? 'Subscription',
        kind: 'expense',
        amount: occ.amount,
        currency: occ.currency,
        date: occ.date,
        status: occ.status,
        accountId: occ.accountId,
        categoryId: occ.categoryId,
        paidAmount:
          occ.paidAmount ??
          (occ.status === 'confirmed' ? occ.amount : undefined),
        accountAmount: occ.paidAmount ?? occ.amount,
        accountCurrency: occ.currency,
        transactionId: occ.confirmedTransactionId,
        templateInactive: template.isActive === false,
      });
    }

    for (const occ of incomes) {
      const template = occ.plannedIncomeId as unknown as Ref | null;
      if (!template) continue;
      result.push({
        source: 'planned_income',
        occurrenceId: occ._id,
        sourceId: template._id,
        name: template.name ?? 'Planned income',
        kind: 'income',
        amount: occ.amount,
        currency: occ.currency,
        date: occ.date,
        status: occ.status,
        accountId: occ.accountId,
        categoryId: occ.categoryId,
        paidAmount:
          occ.receivedAmount ??
          (occ.status === 'confirmed' ? occ.amount : undefined),
        accountAmount: occ.receivedAmount ?? occ.amount,
        accountCurrency: occ.currency,
        transactionId: occ.confirmedTransactionId,
        templateInactive: template.isActive === false,
      });
    }

    return result;
  }

  /** Executes the occurrence through its own module. */
  async confirm(
    source: ExternalSource,
    occurrenceId: Types.ObjectId,
    input: { amount: number; date: Date; note?: string },
    userId?: Types.ObjectId,
  ): Promise<ConfirmResult> {
    const id = occurrenceId.toString();
    const date = input.date.toISOString();

    switch (source) {
      case 'loan': {
        const occ = await this.loansService.confirmOccurrence(
          id,
          { paidAmount: input.amount, paidDate: date, note: input.note },
          userId,
        );
        return {
          transactionId: occ?.confirmedTransactionId,
          accountAmount: occ?.accountAmount,
          accountCurrency: occ?.accountCurrency,
          exchangeRate: occ?.exchangeRate,
        };
      }
      case 'recurring_expense': {
        const occ = await this.recurringExpensesService.confirmOccurrence(
          id,
          userId,
          {
            amount: input.amount,
            paidDate: date,
            note: input.note,
          },
        );
        return {
          transactionId: occ.confirmedTransactionId,
          accountAmount: input.amount,
          accountCurrency: occ.currency,
        };
      }
      case 'subscription': {
        const occ = await this.subscriptionsService.confirmOccurrence(
          id,
          userId,
          {
            amount: input.amount,
            paidDate: date,
            note: input.note,
          },
        );
        return {
          transactionId: occ.confirmedTransactionId,
          accountAmount: input.amount,
          accountCurrency: occ.currency,
        };
      }
      case 'planned_income': {
        const occ = await this.plannedIncomesService.confirmOccurrence(
          id,
          {
            receivedAmount: input.amount,
            receivedDate: date,
            note: input.note,
          },
          userId,
        );
        return {
          transactionId: occ.confirmedTransactionId,
          accountAmount: input.amount,
          accountCurrency: occ.currency,
        };
      }
      default:
        throw new BadRequestException(`Unknown source "${String(source)}"`);
    }
  }

  /** Marks the occurrence as not happening, in its own module. */
  async omit(
    source: ExternalSource,
    occurrenceId: Types.ObjectId,
    userId?: Types.ObjectId,
  ) {
    const id = occurrenceId.toString();
    switch (source) {
      case 'loan':
        return this.loansService.omitOccurrence(id, userId);
      case 'recurring_expense':
        return this.recurringExpensesService.omitOccurrence(id, userId);
      case 'subscription':
        return this.subscriptionsService.omitOccurrence(id, userId);
      case 'planned_income':
        return this.plannedIncomesService.omitOccurrence(id, userId);
      default:
        throw new BadRequestException(`Unknown source "${String(source)}"`);
    }
  }

  /** Occurrences of a recurring expense inside a window (used when a line is promoted). */
  async recurringOccurrencesIn(
    recurringExpenseId: Types.ObjectId,
    period: FortnightPeriod,
  ) {
    return this.recurringOccurrenceModel
      .find({
        recurringExpenseId,
        date: { $gte: period.start, $lte: period.end },
      })
      .sort({ date: 1 })
      .lean();
  }
}
