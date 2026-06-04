import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from '../accounts/schemas/account.schema';
import { Contract, ContractDocument } from '../contracts/schemas/contract.schema';
import { Loan, LoanDocument } from '../loans/schemas/loan.schema';
import {
  LoanPaymentOccurrence,
  LoanPaymentOccurrenceDocument,
} from '../loans/schemas/loan-payment-occurrence.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  PlannedIncome,
  PlannedIncomeDocument,
} from '../planned-incomes/schemas/planned-income.schema';
import {
  PlannedIncomeOccurrence,
  PlannedIncomeOccurrenceDocument,
} from '../planned-incomes/schemas/planned-income-occurrence.schema';
import {
  RecurringExpense,
  RecurringExpenseDocument,
} from '../recurring-expenses/schemas/recurring-expense.schema';
import {
  RecurringExpenseOccurrence,
  RecurringExpenseOccurrenceDocument,
} from '../recurring-expenses/schemas/recurring-expense-occurrence.schema';
import {
  Subscription,
  SubscriptionDocument,
} from '../subscriptions/schemas/subscription.schema';
import {
  SubscriptionOccurrence,
  SubscriptionOccurrenceDocument,
} from '../subscriptions/schemas/subscription-occurrence.schema';
import {
  Transaction,
  TransactionDocument,
} from '../transactions/schemas/transaction.schema';

export type IssueSeverity = 'info' | 'warning' | 'critical';

export type ReconcileIssue = {
  key: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  count: number;
  affectedAmountUsd?: number;
  affectedAmountNio?: number;
  preview: Array<Record<string, unknown>>;
  fixDescription: string;
};

export type DiagnoseResult = {
  generatedAt: string;
  issues: ReconcileIssue[];
};

@Injectable()
export class ReconcileService {
  private readonly logger = new Logger(ReconcileService.name);

  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Transaction.name) private readonly txModel: Model<TransactionDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(PlannedIncome.name)
    private readonly plannedModel: Model<PlannedIncomeDocument>,
    @InjectModel(PlannedIncomeOccurrence.name)
    private readonly plannedOccModel: Model<PlannedIncomeOccurrenceDocument>,
    @InjectModel(RecurringExpense.name)
    private readonly recurringModel: Model<RecurringExpenseDocument>,
    @InjectModel(RecurringExpenseOccurrence.name)
    private readonly recurringOccModel: Model<RecurringExpenseOccurrenceDocument>,
    @InjectModel(Subscription.name)
    private readonly subModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionOccurrence.name)
    private readonly subOccModel: Model<SubscriptionOccurrenceDocument>,
    @InjectModel(Loan.name) private readonly loanModel: Model<LoanDocument>,
    @InjectModel(LoanPaymentOccurrence.name)
    private readonly loanOccModel: Model<LoanPaymentOccurrenceDocument>,
  ) {}

  async diagnose(): Promise<DiagnoseResult> {
    const issues: ReconcileIssue[] = [];
    issues.push(await this.checkOrphanTransactions());
    issues.push(await this.checkOrphanPayments());
    issues.push(await this.checkContractFinancialDrift());
    issues.push(await this.checkOrphanOccurrences());
    return {
      generatedAt: new Date().toISOString(),
      issues: issues.filter((i) => i.count > 0),
    };
  }

  // ============ 1. Orphan transactions ============
  private async checkOrphanTransactions(): Promise<ReconcileIssue> {
    const liveAccountIds = await this.accountModel
      .find({ deletedAt: { $exists: false } })
      .distinct('_id');
    const orphans = await this.txModel
      .find({
        voidedAt: { $exists: false },
        accountId: { $nin: liveAccountIds },
      })
      .limit(200)
      .lean();

    const totals = orphans.reduce(
      (acc, t) => {
        const cur = t.currency as 'USD' | 'NIO';
        const sign = t.flow === 'in' ? 1 : -1;
        if (cur === 'USD') acc.usd += sign * (t.amount ?? 0);
        else if (cur === 'NIO') acc.nio += sign * (t.amount ?? 0);
        return acc;
      },
      { usd: 0, nio: 0 },
    );

    return {
      key: 'orphan-transactions',
      title: 'Transactions for deleted accounts',
      description:
        'Non-voided transactions whose source account was deleted. They keep affecting historical reports but are invisible in the UI.',
      severity: 'warning',
      count: orphans.length,
      affectedAmountUsd: totals.usd,
      affectedAmountNio: totals.nio,
      preview: orphans.slice(0, 10).map((t) => ({
        _id: t._id,
        date: t.date,
        type: t.type,
        flow: t.flow,
        amount: t.amount,
        currency: t.currency,
        reference: t.reference,
        notes: t.notes,
      })),
      fixDescription:
        'Mark each orphan as voided (soft delete). They remain in the database as an audit trail but no longer impact reports.',
    };
  }

  async fixOrphanTransactions(userId?: Types.ObjectId): Promise<{ fixed: number }> {
    const liveAccountIds = await this.accountModel
      .find({ deletedAt: { $exists: false } })
      .distinct('_id');
    const result = await this.txModel.updateMany(
      {
        voidedAt: { $exists: false },
        accountId: { $nin: liveAccountIds },
      },
      { voidedAt: new Date(), voidedBy: userId },
    );
    return { fixed: result.modifiedCount };
  }

  // ============ 2. Orphan payments ============
  private async checkOrphanPayments(): Promise<ReconcileIssue> {
    const liveAccountIds = await this.accountModel
      .find({ deletedAt: { $exists: false } })
      .distinct('_id');
    const liveContractIds = await this.contractModel
      .find({ deletedAt: { $exists: false } })
      .distinct('_id');
    const orphans = await this.paymentModel
      .find({
        voidedAt: { $exists: false },
        $or: [
          { accountId: { $nin: liveAccountIds } },
          { contractId: { $nin: liveContractIds } },
        ],
      })
      .limit(200)
      .lean();

    const totals = orphans.reduce(
      (acc, p) => {
        const cur = (p.currency ?? 'USD') as 'USD' | 'NIO';
        if (cur === 'USD') acc.usd += p.amount ?? 0;
        else acc.nio += p.amount ?? 0;
        return acc;
      },
      { usd: 0, nio: 0 },
    );

    return {
      key: 'orphan-payments',
      title: 'Payments for deleted accounts or contracts',
      description:
        'Payments whose account or contract has been deleted. Their linked transactions and contract financials may be inconsistent.',
      severity: 'warning',
      count: orphans.length,
      affectedAmountUsd: totals.usd,
      affectedAmountNio: totals.nio,
      preview: orphans.slice(0, 10).map((p) => ({
        _id: p._id,
        paymentDate: p.paymentDate,
        amount: p.amount,
        currency: p.currency,
        method: p.method,
        reference: p.reference,
      })),
      fixDescription:
        'Mark each orphan payment as voided (soft delete). Linked transactions are also voided.',
    };
  }

  async fixOrphanPayments(userId?: Types.ObjectId): Promise<{ fixed: number }> {
    const liveAccountIds = await this.accountModel
      .find({ deletedAt: { $exists: false } })
      .distinct('_id');
    const liveContractIds = await this.contractModel
      .find({ deletedAt: { $exists: false } })
      .distinct('_id');
    const orphans = await this.paymentModel.find({
      voidedAt: { $exists: false },
      $or: [
        { accountId: { $nin: liveAccountIds } },
        { contractId: { $nin: liveContractIds } },
      ],
    });
    let fixed = 0;
    for (const p of orphans) {
      p.voidedAt = new Date();
      p.voidedBy = userId;
      await p.save();
      // Void linked transactions too
      await this.txModel.updateMany(
        { linkedPaymentId: p._id, voidedAt: { $exists: false } },
        { voidedAt: new Date(), voidedBy: userId },
      );
      fixed++;
    }
    return { fixed };
  }

  // ============ 3. Contract paidTotal drift ============
  private async checkContractFinancialDrift(): Promise<ReconcileIssue> {
    // Aggregate non-voided payments per contract → expected paidTotal
    const aggregated = await this.paymentModel.aggregate([
      { $match: { voidedAt: { $exists: false } } },
      {
        $group: {
          _id: '$contractId',
          paidTotal: {
            $sum: {
              $ifNull: [
                '$appliedAmount',
                { $add: ['$amount', { $ifNull: ['$retentionAmount', 0] }] },
              ],
            },
          },
          paymentCount: { $sum: 1 },
          lastPaymentDate: { $max: '$paymentDate' },
        },
      },
    ]);

    const expectedMap = new Map<
      string,
      { paidTotal: number; paymentCount: number; lastPaymentDate?: Date }
    >();
    for (const row of aggregated) {
      if (!row._id) continue;
      expectedMap.set(row._id.toString(), {
        paidTotal: Number(row.paidTotal || 0),
        paymentCount: Number(row.paymentCount || 0),
        lastPaymentDate: row.lastPaymentDate,
      });
    }

    const contracts = await this.contractModel
      .find({ deletedAt: { $exists: false } })
      .select('_id title amount currency paidTotal paymentCount lastPaymentDate clientId')
      .populate('clientId', 'name');

    const drifts: Array<{
      _id: string;
      title?: string;
      clientName?: string;
      currency: string;
      currentPaidTotal: number;
      expectedPaidTotal: number;
      delta: number;
    }> = [];

    for (const c of contracts) {
      const expected = expectedMap.get((c._id as Types.ObjectId).toString()) ?? {
        paidTotal: 0,
        paymentCount: 0,
      };
      const round = (n: number) => Math.round(n * 100) / 100;
      const current = round(c.paidTotal ?? 0);
      const exp = round(expected.paidTotal);
      if (Math.abs(current - exp) > 0.01 || (c.paymentCount ?? 0) !== expected.paymentCount) {
        drifts.push({
          _id: (c._id as Types.ObjectId).toString(),
          title: c.title,
          clientName:
            c.clientId && typeof c.clientId === 'object'
              ? (c.clientId as unknown as { name: string }).name
              : undefined,
          currency: c.currency,
          currentPaidTotal: current,
          expectedPaidTotal: exp,
          delta: round(exp - current),
        });
      }
    }

    return {
      key: 'contract-financial-drift',
      title: 'Contracts with stale paidTotal',
      description:
        'paidTotal/paymentCount stored on the contract disagree with the sum of its non-voided payments.',
      severity: 'warning',
      count: drifts.length,
      preview: drifts.slice(0, 10),
      fixDescription:
        'Recompute paidTotal, paymentCount and lastPaymentDate for each contract from the payments table.',
    };
  }

  async fixContractFinancialDrift(): Promise<{ fixed: number }> {
    const aggregated = await this.paymentModel.aggregate([
      { $match: { voidedAt: { $exists: false } } },
      {
        $group: {
          _id: '$contractId',
          paidTotal: {
            $sum: {
              $ifNull: [
                '$appliedAmount',
                { $add: ['$amount', { $ifNull: ['$retentionAmount', 0] }] },
              ],
            },
          },
          paymentCount: { $sum: 1 },
          lastPaymentDate: { $max: '$paymentDate' },
        },
      },
    ]);

    const expectedMap = new Map<
      string,
      { paidTotal: number; paymentCount: number; lastPaymentDate?: Date }
    >();
    for (const row of aggregated) {
      if (!row._id) continue;
      expectedMap.set(row._id.toString(), {
        paidTotal: Number(row.paidTotal || 0),
        paymentCount: Number(row.paymentCount || 0),
        lastPaymentDate: row.lastPaymentDate,
      });
    }

    const contracts = await this.contractModel.find({ deletedAt: { $exists: false } });
    let fixed = 0;
    for (const c of contracts) {
      const expected = expectedMap.get((c._id as Types.ObjectId).toString()) ?? {
        paidTotal: 0,
        paymentCount: 0,
        lastPaymentDate: undefined as Date | undefined,
      };
      const driftAmount = Math.abs((c.paidTotal ?? 0) - expected.paidTotal);
      if (driftAmount > 0.01 || (c.paymentCount ?? 0) !== expected.paymentCount) {
        c.paidTotal = expected.paidTotal;
        c.paymentCount = expected.paymentCount;
        c.lastPaymentDate = expected.lastPaymentDate;
        await c.save();
        fixed++;
      }
    }
    return { fixed };
  }

  // ============ 4. Orphan occurrences (deleted parent) ============
  private async checkOrphanOccurrences(): Promise<ReconcileIssue> {
    const [livePlanned, liveRecurring, liveSubs, liveLoans] = await Promise.all([
      this.plannedModel.find({ deletedAt: { $exists: false } }).distinct('_id'),
      this.recurringModel.find({ deletedAt: { $exists: false } }).distinct('_id'),
      this.subModel.find({ deletedAt: { $exists: false } }).distinct('_id'),
      this.loanModel.find({ deletedAt: { $exists: false } }).distinct('_id'),
    ]);

    const [plannedOrphans, recurringOrphans, subOrphans, loanOrphans] = await Promise.all([
      this.plannedOccModel.countDocuments({ plannedIncomeId: { $nin: livePlanned } }),
      this.recurringOccModel.countDocuments({ recurringExpenseId: { $nin: liveRecurring } }),
      this.subOccModel.countDocuments({ subscriptionId: { $nin: liveSubs } }),
      this.loanOccModel.countDocuments({ loanId: { $nin: liveLoans } }),
    ]);

    const total = plannedOrphans + recurringOrphans + subOrphans + loanOrphans;

    return {
      key: 'orphan-occurrences',
      title: 'Occurrences for deleted recurrence sources',
      description:
        'Planned occurrences whose parent recurrence (planned income, recurring expense, subscription or loan) was deleted.',
      severity: 'info',
      count: total,
      preview:
        total === 0
          ? []
          : [
              { type: 'planned-income', count: plannedOrphans },
              { type: 'recurring-expense', count: recurringOrphans },
              { type: 'subscription', count: subOrphans },
              { type: 'loan', count: loanOrphans },
            ].filter((r) => r.count > 0),
      fixDescription:
        'Permanently delete the orphan occurrences. They are no longer reachable from the UI and were never accounted for in confirmed transactions.',
    };
  }

  async fixOrphanOccurrences(): Promise<{ fixed: number }> {
    const [livePlanned, liveRecurring, liveSubs, liveLoans] = await Promise.all([
      this.plannedModel.find({ deletedAt: { $exists: false } }).distinct('_id'),
      this.recurringModel.find({ deletedAt: { $exists: false } }).distinct('_id'),
      this.subModel.find({ deletedAt: { $exists: false } }).distinct('_id'),
      this.loanModel.find({ deletedAt: { $exists: false } }).distinct('_id'),
    ]);
    const [a, b, c, d] = await Promise.all([
      this.plannedOccModel.deleteMany({ plannedIncomeId: { $nin: livePlanned } }),
      this.recurringOccModel.deleteMany({
        recurringExpenseId: { $nin: liveRecurring },
      }),
      this.subOccModel.deleteMany({ subscriptionId: { $nin: liveSubs } }),
      this.loanOccModel.deleteMany({ loanId: { $nin: liveLoans } }),
    ]);
    return {
      fixed:
        (a.deletedCount ?? 0) +
        (b.deletedCount ?? 0) +
        (c.deletedCount ?? 0) +
        (d.deletedCount ?? 0),
    };
  }

  // ============ Dispatcher ============
  async runFix(issueKey: string, userId?: Types.ObjectId): Promise<{ fixed: number }> {
    switch (issueKey) {
      case 'orphan-transactions':
        return this.fixOrphanTransactions(userId);
      case 'orphan-payments':
        return this.fixOrphanPayments(userId);
      case 'contract-financial-drift':
        return this.fixContractFinancialDrift();
      case 'orphan-occurrences':
        return this.fixOrphanOccurrences();
      default:
        throw new BadRequestException(`Unknown issue key: ${issueKey}`);
    }
  }
}
