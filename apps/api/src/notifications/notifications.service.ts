import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PlannedIncomesService } from '../planned-incomes/planned-incomes.service';
import { BudgetsService } from '../budgets/budgets.service';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { LoansService } from '../loans/loans.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Contract, ContractDocument } from '../contracts/schemas/contract.schema';
import { Estimate, EstimateDocument } from '../estimates/schemas/estimate.schema';

type Currency = 'USD' | 'NIO';

type CashFlowTotals = {
  expectedIncomeUsd: number;
  expectedIncomeNio: number;
  expectedExpenseUsd: number;
  expectedExpenseNio: number;
  netUsd: number;
  netNio: number;
  overdueCount: number;
  totalCount: number;
};

type ContractExpiringItem = {
  _id: string;
  title?: string;
  clientName?: string;
  endDate: Date;
  amount: number;
  currency: Currency;
  billingPeriod: 'monthly' | 'annual' | 'one_time';
  daysRemaining: number;
};

type EstimateAttentionItem = {
  _id: string;
  title?: string;
  clientName?: string;
  amount: number;
  currency: Currency;
  status: 'sent' | 'draft';
  sentAt?: Date;
  validUntil?: Date;
  daysUntilExpiry?: number;
  daysSinceSent?: number;
  reason: 'expiring' | 'expired' | 'stale';
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly plannedIncomesService: PlannedIncomesService,
    private readonly recurringExpensesService: RecurringExpensesService,
    private readonly budgetsService: BudgetsService,
    private readonly loansService: LoansService,
    private readonly subscriptionsService: SubscriptionsService,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Estimate.name) private readonly estimateModel: Model<EstimateDocument>,
  ) {}

  async getNotifications(month?: string) {
    const plannedIncomeAlerts = await this.plannedIncomesService.getAlerts(month);
    const recurringExpenseAlerts = await this.recurringExpensesService.getAlerts(month);
    const [year, monthValue] = month ? month.split('-') : [];
    const budgetAlerts = await this.budgetsService.getAlerts({
      month: monthValue ? Number(monthValue) : undefined,
      year: year ? Number(year) : undefined,
    });
    const loanAlerts = await this.loansService.getAlerts(month);
    const subscriptionAlerts = await this.subscriptionsService.getAlerts(month);

    const contractsExpiring = await this.findContractsExpiring();
    const estimatesAttention = await this.findEstimatesNeedingAttention();
    const summary = this.computeSummary(
      plannedIncomeAlerts.items,
      recurringExpenseAlerts.items,
      loanAlerts.items,
      subscriptionAlerts.items,
    );

    return {
      summary,
      plannedIncome: plannedIncomeAlerts,
      recurringExpense: recurringExpenseAlerts,
      budget: budgetAlerts,
      loans: loanAlerts,
      subscriptions: subscriptionAlerts,
      contractsExpiring: { items: contractsExpiring, count: contractsExpiring.length },
      estimatesAttention: { items: estimatesAttention, count: estimatesAttention.length },
    };
  }

  private async findContractsExpiring(): Promise<ContractExpiringItem[]> {
    const now = new Date();
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);

    const contracts = await this.contractModel
      .find({
        status: 'active',
        deletedAt: { $exists: false },
        endDate: { $gte: now, $lte: horizon },
      })
      .populate('clientId', 'name')
      .sort({ endDate: 1 })
      .limit(20);

    return contracts.map((c) => {
      const endDate = c.endDate as Date;
      const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const client = c.clientId as { name?: string } | null;
      return {
        _id: c._id.toString(),
        title: c.title,
        clientName: client?.name,
        endDate,
        amount: c.amount,
        currency: c.currency,
        billingPeriod: c.billingPeriod,
        daysRemaining,
      };
    });
  }

  private async findEstimatesNeedingAttention(): Promise<EstimateAttentionItem[]> {
    const now = new Date();
    const expiringHorizon = new Date();
    expiringHorizon.setDate(expiringHorizon.getDate() + 14);
    const staleHorizon = new Date();
    staleHorizon.setDate(staleHorizon.getDate() - 7);

    const estimates = await this.estimateModel
      .find({
        status: 'sent',
        deletedAt: { $exists: false },
        $or: [
          { validUntil: { $lte: expiringHorizon } },
          { sentAt: { $lte: staleHorizon } },
        ],
      })
      .populate('clientId', 'name')
      .sort({ validUntil: 1, sentAt: 1 })
      .limit(20);

    return estimates.map((e) => {
      const client = e.clientId as { name?: string } | null;
      const item: EstimateAttentionItem = {
        _id: e._id.toString(),
        title: e.title,
        clientName: client?.name,
        amount: e.amount,
        currency: e.currency,
        status: e.status as 'sent',
        sentAt: e.sentAt,
        validUntil: e.validUntil,
        reason: 'stale',
      };

      if (e.validUntil) {
        const days = Math.ceil((e.validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        item.daysUntilExpiry = days;
        if (days < 0) {
          item.reason = 'expired';
        } else if (days <= 14) {
          item.reason = 'expiring';
        }
      }

      if (e.sentAt) {
        item.daysSinceSent = Math.floor(
          (now.getTime() - e.sentAt.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      return item;
    });
  }

  private computeSummary(
    plannedIncome: Array<{ amount: number; currency: Currency; date: Date | string; status?: string }>,
    recurringExpense: Array<{ amount: number; currency: Currency; date: Date | string; status?: string }>,
    loans: Array<{ amount: number; currency: Currency; date: Date | string; status?: string }>,
    subscriptions: Array<{ amount: number; currency: Currency; date: Date | string; status?: string }>,
  ): CashFlowTotals {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const totals: CashFlowTotals = {
      expectedIncomeUsd: 0,
      expectedIncomeNio: 0,
      expectedExpenseUsd: 0,
      expectedExpenseNio: 0,
      netUsd: 0,
      netNio: 0,
      overdueCount: 0,
      totalCount: 0,
    };

    const addIncome = (amount: number, currency: Currency) => {
      if (currency === 'USD') totals.expectedIncomeUsd += amount;
      else totals.expectedIncomeNio += amount;
    };
    const addExpense = (amount: number, currency: Currency) => {
      if (currency === 'USD') totals.expectedExpenseUsd += amount;
      else totals.expectedExpenseNio += amount;
    };
    const tally = (
      items: Array<{ amount: number; currency: Currency; date: Date | string; status?: string }>,
      kind: 'income' | 'expense',
    ) => {
      for (const it of items) {
        totals.totalCount += 1;
        if (kind === 'income') addIncome(it.amount, it.currency);
        else addExpense(it.amount, it.currency);
        const d = new Date(it.date);
        if (d < today) totals.overdueCount += 1;
      }
    };

    tally(plannedIncome, 'income');
    tally(recurringExpense, 'expense');
    tally(loans, 'expense');
    tally(subscriptions, 'expense');

    totals.netUsd = totals.expectedIncomeUsd - totals.expectedExpenseUsd;
    totals.netNio = totals.expectedIncomeNio - totals.expectedExpenseNio;

    return totals;
  }
}
