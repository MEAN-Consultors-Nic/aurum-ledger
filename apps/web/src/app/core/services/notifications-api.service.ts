import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PlannedIncomeAlerts } from '../models/planned-income.model';
import { BudgetAlerts, RecurringExpenseAlerts } from '../models/recurring-expense.model';
import { LoanAlerts } from '../models/loan.model';
import { SubscriptionAlerts } from '../models/subscription.model';

export type CashFlowTotals = {
  expectedIncomeUsd: number;
  expectedIncomeNio: number;
  expectedExpenseUsd: number;
  expectedExpenseNio: number;
  netUsd: number;
  netNio: number;
  overdueCount: number;
  totalCount: number;
};

export type ContractExpiringItem = {
  _id: string;
  title?: string;
  clientName?: string;
  endDate: string;
  amount: number;
  currency: 'USD' | 'NIO';
  billingPeriod: 'monthly' | 'annual' | 'one_time';
  daysRemaining: number;
};

export type EstimateAttentionItem = {
  _id: string;
  title?: string;
  clientName?: string;
  amount: number;
  currency: 'USD' | 'NIO';
  status: 'sent' | 'draft';
  sentAt?: string;
  validUntil?: string;
  daysUntilExpiry?: number;
  daysSinceSent?: number;
  reason: 'expiring' | 'expired' | 'stale';
};

export type NotificationsResponse = {
  summary: CashFlowTotals;
  plannedIncome: PlannedIncomeAlerts;
  recurringExpense: RecurringExpenseAlerts;
  budget: BudgetAlerts;
  loans: LoanAlerts;
  subscriptions: SubscriptionAlerts;
  contractsExpiring: { items: ContractExpiringItem[]; count: number };
  estimatesAttention: { items: EstimateAttentionItem[]; count: number };
};

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  constructor(private readonly http: HttpClient) {}

  getNotifications(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<NotificationsResponse>(`${environment.apiUrl}/notifications`, {
      params: httpParams,
    });
  }
}
