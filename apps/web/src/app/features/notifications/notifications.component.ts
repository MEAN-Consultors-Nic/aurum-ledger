import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  CashFlowTotals,
  ContractExpiringItem,
  EstimateAttentionItem,
  NotificationsApiService,
} from '../../core/services/notifications-api.service';
import { PlannedIncomeOccurrence } from '../../core/models/planned-income.model';
import { BudgetAlertItem, RecurringExpenseOccurrence } from '../../core/models/recurring-expense.model';
import { LoanPaymentOccurrence } from '../../core/models/loan.model';
import { SubscriptionOccurrence } from '../../core/models/subscription.model';

type ActionKind = 'income' | 'expense' | 'loan' | 'subscription';
type UrgencyBucket = 'overdue' | 'today' | 'thisWeek' | 'later';

type ActionItem = {
  id: string;
  kind: ActionKind;
  name: string;
  accountName: string;
  date: string;
  amount: number;
  currency: 'USD' | 'NIO';
  daysFromToday: number;
  bucket: UrgencyBucket;
};

const SEVERITY_PALETTE: Record<UrgencyBucket, { border: string; chip: string; label: string }> = {
  overdue: { border: 'border-l-rose-500', chip: 'bg-rose-100 text-rose-700', label: 'Overdue' },
  today: { border: 'border-l-amber-500', chip: 'bg-amber-100 text-amber-700', label: 'Today' },
  thisWeek: { border: 'border-l-sky-500', chip: 'bg-sky-100 text-sky-700', label: 'This week' },
  later: { border: 'border-l-slate-300', chip: 'bg-slate-100 text-slate-700', label: 'Later' },
};

const KIND_BADGE: Record<ActionKind, { label: string; tone: string; icon: string }> = {
  income: { label: 'Income', tone: 'bg-emerald-50 text-emerald-700', icon: '↑' },
  expense: { label: 'Expense', tone: 'bg-rose-50 text-rose-700', icon: '↓' },
  loan: { label: 'Loan', tone: 'bg-amber-50 text-amber-700', icon: '⊗' },
  subscription: { label: 'Subscription', tone: 'bg-violet-50 text-violet-700', icon: '↻' },
};

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="space-y-6">
      <!-- HERO -->
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-slate-900">Action center</div>
          <div class="mt-1 text-sm text-slate-500">
            Everything that needs your attention this month — cash flow, contracts, estimates and recurring activity.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="month"
            [(ngModel)]="selectedMonth"
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
            (click)="load()"
            [disabled]="isLoading"
          >
            {{ isLoading ? 'Refreshing…' : 'Refresh' }}
          </button>
        </div>
      </header>

      <!-- KPIs -->
      <section *ngIf="summary" class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Expected income</div>
          <div class="mt-1.5 text-xl font-semibold text-emerald-700">
            USD {{ formatNumber(summary.expectedIncomeUsd) }}
          </div>
          <div *ngIf="summary.expectedIncomeNio > 0" class="text-xs text-slate-500">
            NIO {{ formatNumber(summary.expectedIncomeNio) }}
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Expected outflow</div>
          <div class="mt-1.5 text-xl font-semibold text-rose-700">
            USD {{ formatNumber(summary.expectedExpenseUsd) }}
          </div>
          <div *ngIf="summary.expectedExpenseNio > 0" class="text-xs text-slate-500">
            NIO {{ formatNumber(summary.expectedExpenseNio) }}
          </div>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Net (expected)</div>
          <div
            class="mt-1.5 text-xl font-semibold"
            [ngClass]="summary.netUsd >= 0 ? 'text-emerald-700' : 'text-rose-700'"
          >
            {{ summary.netUsd >= 0 ? '+' : '' }}USD {{ formatNumber(summary.netUsd) }}
          </div>
          <div *ngIf="summary.netNio !== 0" class="text-xs text-slate-500">
            {{ summary.netNio >= 0 ? '+' : '' }}NIO {{ formatNumber(summary.netNio) }}
          </div>
        </div>

        <div class="rounded-xl border bg-white p-4 shadow-sm"
          [ngClass]="summary.overdueCount > 0 ? 'border-rose-300' : 'border-slate-200'">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Overdue items</div>
          <div class="mt-1.5 flex items-baseline gap-2">
            <div class="text-2xl font-bold"
              [ngClass]="summary.overdueCount > 0 ? 'text-rose-700' : 'text-slate-400'">
              {{ summary.overdueCount }}
            </div>
            <div class="text-xs text-slate-500">of {{ summary.totalCount }} alerts</div>
          </div>
        </div>
      </section>

      <!-- LOADING / EMPTY -->
      <div *ngIf="isLoading" class="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
        Loading alerts…
      </div>

      <div *ngIf="!isLoading && nothingToShow()"
        class="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4">
        <div class="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">✓</div>
        <div>
          <div class="text-sm font-semibold text-emerald-900">All clear for {{ monthLabel() }}</div>
          <div class="text-xs text-emerald-800">
            No overdue items, no expiring contracts or estimates, no budget breaches. Nice work.
          </div>
        </div>
      </div>

      <!-- ACTION FEED -->
      <section *ngIf="!isLoading && actionFeed.length > 0" class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <div class="text-sm font-semibold text-slate-900">Cash flow action feed</div>
            <div class="text-xs text-slate-500">{{ actionFeed.length }} item{{ actionFeed.length === 1 ? '' : 's' }} grouped by urgency</div>
          </div>
        </header>

        <div *ngFor="let group of bucketsInOrder; let last = last"
          class="border-b border-slate-100 last:border-b-0">
          <ng-container *ngIf="grouped()[group].length > 0">
            <div class="flex items-center gap-2 px-5 pt-3 pb-1">
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                [ngClass]="palette[group].chip">
                {{ palette[group].label }}
              </span>
              <span class="text-xs text-slate-500">{{ grouped()[group].length }} item{{ grouped()[group].length === 1 ? '' : 's' }}</span>
            </div>

            <ul class="px-5 pb-3">
              <li *ngFor="let item of grouped()[group]"
                class="flex flex-wrap items-center gap-x-4 gap-y-1 border-l-2 border-l-slate-200 py-2.5 pl-3 hover:bg-slate-50"
                [ngClass]="palette[item.bucket].border">
                <span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  [ngClass]="kindBadge[item.kind].tone">
                  <span>{{ kindBadge[item.kind].icon }}</span>
                  <span>{{ kindBadge[item.kind].label }}</span>
                </span>
                <span class="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{{ item.name }}</span>
                <span class="text-xs text-slate-500">{{ item.accountName || '—' }}</span>
                <span class="text-xs text-slate-500 tabular-nums">{{ relativeDate(item.daysFromToday, item.date) }}</span>
                <span class="text-sm font-semibold tabular-nums"
                  [ngClass]="item.kind === 'income' ? 'text-emerald-700' : 'text-slate-900'">
                  {{ item.currency }} {{ formatNumber(item.amount) }}
                </span>
                <a [routerLink]="routeForKind(item.kind)"
                  class="rounded-md border border-slate-200 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100">
                  Open
                </a>
              </li>
            </ul>
          </ng-container>
        </div>
      </section>

      <!-- CONTRACTS EXPIRING -->
      <section *ngIf="!isLoading && contractsExpiring.length > 0"
        class="rounded-xl border border-amber-200 bg-white shadow-sm">
        <header class="flex items-center justify-between border-b border-amber-100 px-5 py-3.5">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">!</span>
            <div>
              <div class="text-sm font-semibold text-slate-900">Contracts expiring within 30 days</div>
              <div class="text-xs text-slate-500">Renew or wind down before the end date hits</div>
            </div>
          </div>
          <a routerLink="/contracts" class="text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900">Open contracts</a>
        </header>
        <ul class="divide-y divide-slate-100">
          <li *ngFor="let c of contractsExpiring"
            class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-slate-50">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-slate-900">{{ c.title || 'Untitled contract' }}</div>
              <div class="text-xs text-slate-500">{{ c.clientName || '—' }} · {{ c.billingPeriod }}</div>
            </div>
            <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              [ngClass]="contractDaysChip(c.daysRemaining)">
              {{ contractDaysLabel(c.daysRemaining) }}
            </span>
            <span class="text-xs text-slate-500 tabular-nums">{{ formatDate(c.endDate) }}</span>
            <span class="text-sm font-semibold tabular-nums text-slate-900">
              {{ c.currency }} {{ formatNumber(c.amount) }}
            </span>
          </li>
        </ul>
      </section>

      <!-- ESTIMATES NEEDING ATTENTION -->
      <section *ngIf="!isLoading && estimatesAttention.length > 0"
        class="rounded-xl border border-violet-200 bg-white shadow-sm">
        <header class="flex items-center justify-between border-b border-violet-100 px-5 py-3.5">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">$</span>
            <div>
              <div class="text-sm font-semibold text-slate-900">Estimates needing follow-up</div>
              <div class="text-xs text-slate-500">Sent estimates that are expiring, expired, or stale</div>
            </div>
          </div>
          <a routerLink="/estimates" class="text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900">Open estimates</a>
        </header>
        <ul class="divide-y divide-slate-100">
          <li *ngFor="let e of estimatesAttention"
            class="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-slate-50">
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-slate-900">{{ e.title || 'Untitled estimate' }}</div>
              <div class="text-xs text-slate-500">
                {{ e.clientName || '—' }}
                <span *ngIf="e.daysSinceSent !== undefined"> · sent {{ e.daysSinceSent }}d ago</span>
              </div>
            </div>
            <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
              [ngClass]="estimateReasonChip(e.reason)">
              {{ estimateReasonLabel(e) }}
            </span>
            <a [routerLink]="['/estimates', e._id]"
              class="text-sm font-semibold tabular-nums text-slate-900 hover:underline">
              {{ e.currency }} {{ formatNumber(e.amount) }}
            </a>
          </li>
        </ul>
      </section>

      <!-- BUDGET BREACHES -->
      <section *ngIf="!isLoading && budgetAlerts.length > 0"
        class="rounded-xl border border-rose-200 bg-white shadow-sm">
        <header class="flex items-center justify-between border-b border-rose-100 px-5 py-3.5">
          <div class="flex items-center gap-2">
            <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">▲</span>
            <div>
              <div class="text-sm font-semibold text-slate-900">Budget warnings</div>
              <div class="text-xs text-slate-500">Categories approaching or exceeding limits</div>
            </div>
          </div>
          <a routerLink="/budgets" class="text-xs font-semibold uppercase tracking-wide text-slate-600 hover:text-slate-900">Open budgets</a>
        </header>
        <ul class="divide-y divide-slate-100">
          <li *ngFor="let b of budgetAlerts" class="px-5 py-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="font-medium text-sm text-slate-900">{{ b.categoryName }}</div>
              <div class="text-xs text-slate-500 tabular-nums">
                {{ b.currency }} {{ formatNumber(b.spent) }} / {{ formatNumber(b.amount) }}
                <span class="ml-2 font-semibold"
                  [ngClass]="b.usage >= 1 ? 'text-rose-700' : 'text-amber-700'">
                  {{ (b.usage * 100).toFixed(0) }}%
                </span>
              </div>
            </div>
            <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full transition-all"
                [ngClass]="b.usage >= 1 ? 'bg-rose-500' : (b.usage >= 0.8 ? 'bg-amber-500' : 'bg-emerald-500')"
                [style.width.%]="Math.min(b.usage * 100, 100)">
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  `,
})
export class NotificationsComponent implements OnInit {
  summary: CashFlowTotals | null = null;
  plannedIncomeAlerts: PlannedIncomeOccurrence[] = [];
  recurringExpenseAlerts: RecurringExpenseOccurrence[] = [];
  budgetAlerts: BudgetAlertItem[] = [];
  loanAlerts: LoanPaymentOccurrence[] = [];
  subscriptionAlerts: SubscriptionOccurrence[] = [];
  contractsExpiring: ContractExpiringItem[] = [];
  estimatesAttention: EstimateAttentionItem[] = [];
  selectedMonth = new Date().toISOString().slice(0, 7);
  isLoading = false;

  actionFeed: ActionItem[] = [];
  readonly bucketsInOrder: UrgencyBucket[] = ['overdue', 'today', 'thisWeek', 'later'];
  readonly palette = SEVERITY_PALETTE;
  readonly kindBadge = KIND_BADGE;
  readonly Math = Math;

  constructor(private readonly notificationsApi: NotificationsApiService) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.notificationsApi.getNotifications(this.selectedMonth).subscribe({
      next: (data) => {
        this.summary = data.summary ?? null;
        this.plannedIncomeAlerts = data.plannedIncome?.items ?? [];
        this.recurringExpenseAlerts = data.recurringExpense?.items ?? [];
        this.budgetAlerts = data.budget?.items ?? [];
        this.loanAlerts = data.loans?.items ?? [];
        this.subscriptionAlerts = data.subscriptions?.items ?? [];
        this.contractsExpiring = data.contractsExpiring?.items ?? [];
        this.estimatesAttention = data.estimatesAttention?.items ?? [];
        this.buildActionFeed();
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      },
    });
  }

  nothingToShow(): boolean {
    return (
      this.actionFeed.length === 0 &&
      this.contractsExpiring.length === 0 &&
      this.estimatesAttention.length === 0 &&
      this.budgetAlerts.length === 0
    );
  }

  private buildActionFeed() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toAction = (
      item: PlannedIncomeOccurrence | RecurringExpenseOccurrence | LoanPaymentOccurrence | SubscriptionOccurrence,
      kind: ActionKind,
      name: string,
    ): ActionItem => {
      const date = new Date(item.date as unknown as string);
      const days = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let bucket: UrgencyBucket;
      if (days < 0) bucket = 'overdue';
      else if (days === 0) bucket = 'today';
      else if (days <= 7) bucket = 'thisWeek';
      else bucket = 'later';
      return {
        id: (item as { _id?: string })._id ?? '',
        kind,
        name,
        accountName: this.resolveAccountName(item),
        date: date.toISOString(),
        amount: item.amount,
        currency: item.currency,
        daysFromToday: days,
        bucket,
      };
    };

    const items: ActionItem[] = [
      ...this.plannedIncomeAlerts.map((i) => toAction(i, 'income', this.resolvePlannedName(i))),
      ...this.recurringExpenseAlerts.map((i) => toAction(i, 'expense', this.resolveRecurringName(i))),
      ...this.loanAlerts.map((i) => toAction(i, 'loan', this.resolveLoanName(i))),
      ...this.subscriptionAlerts.map((i) =>
        toAction(i, 'subscription', this.resolveSubscriptionName(i)),
      ),
    ];

    items.sort((a, b) => a.daysFromToday - b.daysFromToday);
    this.actionFeed = items;
  }

  grouped(): Record<UrgencyBucket, ActionItem[]> {
    const out: Record<UrgencyBucket, ActionItem[]> = {
      overdue: [],
      today: [],
      thisWeek: [],
      later: [],
    };
    for (const it of this.actionFeed) {
      out[it.bucket].push(it);
    }
    return out;
  }

  routeForKind(kind: ActionKind): string {
    switch (kind) {
      case 'income':
        return '/planned-income';
      case 'expense':
        return '/recurring-expenses';
      case 'loan':
        return '/loans';
      case 'subscription':
        return '/subscriptions';
    }
  }

  relativeDate(days: number, iso: string): string {
    if (days === 0) return 'Today';
    if (days === -1) return 'Yesterday';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return `${Math.abs(days)}d ago`;
    if (days <= 14) return `in ${days}d`;
    return this.formatDate(iso);
  }

  contractDaysChip(days: number): string {
    if (days <= 7) return 'bg-rose-100 text-rose-700';
    if (days <= 14) return 'bg-amber-100 text-amber-700';
    return 'bg-sky-100 text-sky-700';
  }

  contractDaysLabel(days: number): string {
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `in ${days}d`;
  }

  estimateReasonChip(reason: 'expiring' | 'expired' | 'stale'): string {
    if (reason === 'expired') return 'bg-rose-100 text-rose-700';
    if (reason === 'expiring') return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-700';
  }

  estimateReasonLabel(e: EstimateAttentionItem): string {
    if (e.reason === 'expired') return `Expired ${Math.abs(e.daysUntilExpiry ?? 0)}d ago`;
    if (e.reason === 'expiring') return `Expires in ${e.daysUntilExpiry}d`;
    return `No response ${e.daysSinceSent ?? 0}d`;
  }

  monthLabel(): string {
    const [year, month] = this.selectedMonth.split('-');
    if (!year || !month) return '';
    return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  resolveAccountName(
    item: PlannedIncomeOccurrence | RecurringExpenseOccurrence | LoanPaymentOccurrence | SubscriptionOccurrence,
  ) {
    const account = item.accountId as { _id: string; name: string } | string;
    return typeof account === 'string' ? account : account?.name || '';
  }

  resolvePlannedName(item: PlannedIncomeOccurrence) {
    const planned = item.plannedIncomeId as { _id: string; name: string } | string;
    return typeof planned === 'string' ? planned : planned?.name || '';
  }

  resolveRecurringName(item: RecurringExpenseOccurrence) {
    const recurring = item.recurringExpenseId as { _id: string; name: string } | string;
    return typeof recurring === 'string' ? recurring : recurring?.name || '';
  }

  resolveLoanName(item: LoanPaymentOccurrence) {
    const loan = item.loanId as { _id: string; name: string } | string;
    return typeof loan === 'string' ? loan : loan?.name || '';
  }

  resolveSubscriptionName(item: SubscriptionOccurrence) {
    const subscription = item.subscriptionId as { _id: string; name: string } | string;
    return typeof subscription === 'string' ? subscription : subscription?.name || '';
  }

  formatDate(value?: string) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatNumber(value: number | undefined): string {
    return Number(value ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
