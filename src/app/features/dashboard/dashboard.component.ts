import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ApexAnnotations,
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexMarkers,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { AuthService } from '../../core/services/auth.service';
import { ContractsApiService } from '../../core/services/contracts-api.service';
import { EstimatesApiService } from '../../core/services/estimates-api.service';
import { FinanceApiService } from '../../core/services/finance-api.service';
import { NotificationsApiService } from '../../core/services/notifications-api.service';
import { PlannedIncomesApiService } from '../../core/services/planned-incomes-api.service';
import { RecurringExpensesApiService } from '../../core/services/recurring-expenses-api.service';
import { ReportsApiService } from '../../core/services/reports-api.service';
import { environment } from '../../../environments/environment';
import { AccountItem } from '../../core/models/account.model';
import { ContractItem } from '../../core/models/contract.model';
import { DashboardOverview } from '../../core/models/dashboard.model';
import {
  FinanceByCategoryItem,
  FinanceByClientItem,
  FinanceOverview,
} from '../../core/models/finance.model';
import { LoanAlerts, LoanPaymentOccurrence } from '../../core/models/loan.model';
import {
  PlannedIncomeAlerts,
  PlannedIncomeOccurrence,
  PlannedIncomeSummary,
} from '../../core/models/planned-income.model';
import {
  BudgetAlertItem,
  RecurringExpenseAlerts,
  RecurringExpenseOccurrence,
} from '../../core/models/recurring-expense.model';
import { TrendItem } from '../../core/models/report.model';
import { SubscriptionAlerts, SubscriptionOccurrence } from '../../core/models/subscription.model';

type ActionGroup = {
  key: string;
  label: string;
  count: number;
  amountUsd: number;
  tone: 'danger' | 'warning' | 'info';
  link: string;
};

type UpcomingItem = {
  name: string;
  date: string;
  amount: number;
  currency: 'USD' | 'NIO';
  flow: 'in' | 'out';
  source: 'planned-income' | 'recurring-expense' | 'loan' | 'subscription';
};

type BudgetRow = {
  categoryName: string;
  spent: number;
  budget: number;
  currency: 'USD' | 'NIO';
  usage: number;
};

type CashflowChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  fill: ApexFill;
  legend: ApexLegend;
  markers: ApexMarkers;
  tooltip: ApexTooltip;
  grid: ApexGrid;
  annotations: ApexAnnotations;
  colors: string[];
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NgApexchartsModule],
  template: `
    <div class="space-y-6">
      <!-- HERO -->
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-3xl font-semibold tracking-tight text-slate-900">
            {{ greeting() }}<ng-container *ngIf="firstName()">, {{ firstName() }}</ng-container>
          </div>
          <div class="mt-1 text-sm text-slate-500">
            {{ todayLabel() }} <span class="text-slate-300">·</span> Snapshot for {{ monthLabel() }}
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <a
            *ngIf="totalActions() > 0"
            routerLink="/notifications"
            class="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-700 transition hover:bg-rose-100"
          >
            <span class="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold text-white">
              {{ totalActions() }}
            </span>
            Pending actions
          </a>
          <a
            routerLink="/payments"
            class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
          >
            + Record payment
          </a>
          <a
            routerLink="/transactions"
            class="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800"
          >
            + New transaction
          </a>
        </div>
      </header>

      <!-- KPI CARDS -->
      <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <!-- Cash on hand -->
        <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Cash on hand</div>
            <span class="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              {{ accounts.length }} {{ accounts.length === 1 ? 'account' : 'accounts' }}
            </span>
          </div>
          <div class="mt-3 flex items-baseline gap-2">
            <div class="text-2xl font-semibold text-slate-900">
              {{ formatMoney(totalCashUsdEquivalent(), 'USD') }}
            </div>
            <div class="text-xs text-slate-400">equivalent</div>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="rounded-md bg-slate-50 px-2 py-1.5">
              <div class="text-[10px] uppercase tracking-wide text-slate-500">USD</div>
              <div class="font-semibold text-slate-900">{{ formatNumber(balanceUsd()) }}</div>
            </div>
            <div class="rounded-md bg-slate-50 px-2 py-1.5">
              <div class="text-[10px] uppercase tracking-wide text-slate-500">NIO</div>
              <div class="font-semibold text-slate-900">{{ formatNumber(balanceNio()) }}</div>
            </div>
          </div>
        </article>

        <!-- This month income -->
        <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Income this month</div>
            <span
              [ngClass]="incomeMoMChange() >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
              class="rounded-full px-2 py-0.5 text-[10px] font-medium"
            >
              {{ incomeMoMChange() >= 0 ? '+' : '' }}{{ incomeMoMChange().toFixed(0) }}% MoM
            </span>
          </div>
          <div class="mt-3 text-2xl font-semibold text-slate-900">
            {{ formatMoney(paidThisMonthUsdEq(), 'USD') }}
          </div>
          <div class="mt-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between text-slate-600">
              <span>USD received</span>
              <span class="font-semibold text-slate-900">{{ formatNumber(overview?.totalPaidThisMonthUsd || 0) }}</span>
            </div>
            <div class="flex items-center justify-between text-slate-600">
              <span>NIO received</span>
              <span class="font-semibold text-slate-900">{{ formatNumber(overview?.totalPaidThisMonthNio || 0) }}</span>
            </div>
          </div>
        </article>

        <!-- Outstanding receivables -->
        <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outstanding</div>
            <span
              *ngIf="overview?.overdueCount"
              class="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-medium text-rose-700"
            >
              {{ overview?.overdueCount }} overdue
            </span>
          </div>
          <div class="mt-3 text-2xl font-semibold text-slate-900">
            {{ formatMoney(totalOutstandingUsdEq(), 'USD') }}
          </div>
          <div class="mt-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between text-slate-600">
              <span>USD pending</span>
              <span class="font-semibold text-slate-900">{{ formatNumber(overview?.totalReceivableUsd || 0) }}</span>
            </div>
            <div class="flex items-center justify-between text-slate-600">
              <span>NIO pending</span>
              <span class="font-semibold text-slate-900">{{ formatNumber(overview?.totalReceivableNio || 0) }}</span>
            </div>
            <div class="flex items-center justify-between border-t border-slate-100 pt-1.5 text-slate-600">
              <span>Due in 30 days</span>
              <span class="font-semibold text-slate-900">{{ overview?.dueNext30Days || 0 }} contracts</span>
            </div>
          </div>
        </article>

        <!-- Active operations -->
        <article class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pipeline</div>
            <a routerLink="/estimates" class="text-[10px] font-medium uppercase tracking-wide text-slate-500 hover:text-slate-900">
              View →
            </a>
          </div>
          <div class="mt-3 text-2xl font-semibold text-slate-900">
            {{ pendingEstimatesCount }}
            <span class="text-xs font-normal text-slate-500">estimates open</span>
          </div>
          <div class="mt-3 space-y-1.5 text-xs">
            <div class="flex items-center justify-between text-slate-600">
              <span>Active contracts</span>
              <span class="font-semibold text-slate-900">{{ activeContractsCount }}</span>
            </div>
            <div class="flex items-center justify-between text-slate-600">
              <span>Planned vs confirmed</span>
              <span class="font-semibold text-slate-900">{{ plannedConfirmationRate() }}%</span>
            </div>
            <div class="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                class="h-full bg-slate-900 transition-all"
                [style.width.%]="plannedConfirmationRate()"
              ></div>
            </div>
          </div>
        </article>
      </section>

      <!-- ACTION CENTER -->
      <section class="grid gap-4 lg:grid-cols-5">
        <!-- Pending actions -->
        <div class="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-3">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div class="text-sm font-semibold text-slate-900">Pending actions</div>
              <div class="text-xs text-slate-500">Items waiting on you this month</div>
            </div>
            <span
              *ngIf="totalActions() > 0"
              class="rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700"
            >
              {{ totalActions() }} total
            </span>
            <span
              *ngIf="totalActions() === 0"
              class="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
            >
              All clear
            </span>
          </div>

          <div *ngIf="actionGroups().length > 0" class="divide-y divide-slate-100">
            <a
              *ngFor="let group of actionGroups()"
              [routerLink]="group.link"
              class="flex items-center justify-between px-5 py-3 transition hover:bg-slate-50"
            >
              <div class="flex items-center gap-3">
                <span
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold"
                  [ngClass]="{
                    'bg-rose-50 text-rose-700': group.tone === 'danger',
                    'bg-amber-50 text-amber-700': group.tone === 'warning',
                    'bg-sky-50 text-sky-700': group.tone === 'info'
                  }"
                >
                  {{ group.count }}
                </span>
                <div>
                  <div class="text-sm font-medium text-slate-900">{{ group.label }}</div>
                  <div *ngIf="group.amountUsd > 0" class="text-xs text-slate-500">
                    ≈ {{ formatMoney(group.amountUsd, 'USD') }} at risk
                  </div>
                </div>
              </div>
              <span class="text-slate-300">→</span>
            </a>
          </div>

          <div *ngIf="actionGroups().length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
            <div class="mx-auto mb-2 inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              ✓
            </div>
            <div class="font-medium text-slate-700">Inbox zero</div>
            <div class="text-xs">No occurrences or alerts to handle this month.</div>
          </div>

          <!-- Upcoming this week -->
          <div *ngIf="upcomingThisWeek().length > 0" class="border-t border-slate-100 px-5 py-4">
            <div class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Coming up this week</div>
            <div class="space-y-2">
              <div
                *ngFor="let item of upcomingThisWeek()"
                class="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs"
              >
                <div class="flex items-center gap-2">
                  <span
                    class="h-1.5 w-1.5 rounded-full"
                    [ngClass]="item.flow === 'in' ? 'bg-emerald-500' : 'bg-rose-500'"
                  ></span>
                  <span class="font-medium text-slate-900">{{ item.name }}</span>
                  <span class="text-slate-500">· {{ formatShortDate(item.date) }}</span>
                </div>
                <span class="font-semibold" [ngClass]="item.flow === 'in' ? 'text-emerald-700' : 'text-slate-900'">
                  {{ item.flow === 'in' ? '+' : '−' }} {{ formatMoney(item.amount, item.currency) }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Receivables to chase -->
        <div class="rounded-xl border border-slate-200 bg-white shadow-sm lg:col-span-2">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <div class="text-sm font-semibold text-slate-900">Receivables</div>
              <div class="text-xs text-slate-500">Contracts to follow up</div>
            </div>
            <a routerLink="/contracts" class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900">
              All →
            </a>
          </div>

          <!-- Overdue -->
          <div class="px-5 py-3">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Overdue</span>
              <span class="text-[11px] font-semibold text-slate-900">{{ overdueContracts.length }}</span>
            </div>
            <div *ngIf="overdueContracts.length === 0" class="rounded-md bg-emerald-50/60 px-3 py-2 text-xs text-emerald-700">
              No overdue contracts.
            </div>
            <div *ngIf="overdueContracts.length > 0" class="space-y-1.5">
              <a
                *ngFor="let c of overdueContracts.slice(0, 4)"
                routerLink="/contracts"
                class="flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition hover:bg-slate-50"
              >
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-900">{{ getClientName(c) }}</div>
                  <div class="truncate text-[11px] text-slate-500">
                    {{ getServiceName(c) }} · {{ daysAgo(c.endDate) }}d overdue
                  </div>
                </div>
                <div class="ml-2 text-right">
                  <div class="font-semibold text-rose-700">{{ formatMoney(c.balance || 0, c.currency) }}</div>
                </div>
              </a>
            </div>
          </div>

          <!-- Due soon -->
          <div class="border-t border-slate-100 px-5 py-3">
            <div class="mb-2 flex items-center justify-between">
              <span class="text-[11px] font-semibold uppercase tracking-wider text-amber-700">Due in 30 days</span>
              <span class="text-[11px] font-semibold text-slate-900">{{ dueSoonContracts.length }}</span>
            </div>
            <div *ngIf="dueSoonContracts.length === 0" class="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
              Nothing due this month.
            </div>
            <div *ngIf="dueSoonContracts.length > 0" class="space-y-1.5">
              <a
                *ngFor="let c of dueSoonContracts.slice(0, 4)"
                routerLink="/contracts"
                class="flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition hover:bg-slate-50"
              >
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-900">{{ getClientName(c) }}</div>
                  <div class="truncate text-[11px] text-slate-500">
                    {{ getServiceName(c) }} · in {{ daysUntil(c.endDate) }}d
                  </div>
                </div>
                <div class="ml-2 text-right">
                  <div class="font-semibold text-slate-900">{{ formatMoney(c.balance || 0, c.currency) }}</div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      <!-- CASHFLOW CHART -->
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div class="text-sm font-semibold text-slate-900">Cashflow — last 6 months</div>
            <div class="text-xs text-slate-500">Income received vs outstanding receivables (USD-equivalent)</div>
          </div>
        </div>

        <div *ngIf="trends.length === 0" class="mt-6 py-10 text-center text-sm text-slate-500">
          Loading cashflow data…
        </div>

        <div *ngIf="trends.length > 0 && cashflowChart" class="mt-4">
          <apx-chart
            [series]="cashflowChart.series"
            [chart]="cashflowChart.chart"
            [xaxis]="cashflowChart.xaxis"
            [yaxis]="cashflowChart.yaxis"
            [plotOptions]="cashflowChart.plotOptions"
            [dataLabels]="cashflowChart.dataLabels"
            [stroke]="cashflowChart.stroke"
            [fill]="cashflowChart.fill"
            [legend]="cashflowChart.legend"
            [markers]="cashflowChart.markers"
            [tooltip]="cashflowChart.tooltip"
            [grid]="cashflowChart.grid"
            [annotations]="cashflowChart.annotations"
            [colors]="cashflowChart.colors"
          ></apx-chart>

          <div class="mt-3 grid grid-cols-2 gap-4 border-t border-slate-100 pt-3 text-xs md:grid-cols-4">
            <div>
              <div class="text-slate-500">6-mo received</div>
              <div class="font-semibold text-slate-900">{{ formatMoney(totalReceived6m(), 'USD') }}</div>
            </div>
            <div>
              <div class="text-slate-500">Avg / month</div>
              <div class="font-semibold text-slate-900">{{ formatMoney(avgIncome(), 'USD') }}</div>
            </div>
            <div>
              <div class="text-slate-500">Best month</div>
              <div class="font-semibold text-slate-900">{{ bestMonth() }}</div>
            </div>
            <div>
              <div class="text-slate-500">Outstanding now</div>
              <div class="font-semibold text-slate-900">{{ formatMoney(totalOutstandingUsdEq(), 'USD') }}</div>
            </div>
          </div>
        </div>
      </section>

      <!-- INSIGHTS -->
      <section class="grid gap-4 lg:grid-cols-3">
        <!-- Accounts -->
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold text-slate-900">Accounts</div>
              <div class="text-xs text-slate-500">Balance per account</div>
            </div>
            <a routerLink="/accounts" class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900">All →</a>
          </div>
          <div *ngIf="accounts.length === 0" class="mt-4 text-xs text-slate-500">No accounts yet.</div>
          <ul *ngIf="accounts.length > 0" class="mt-3 space-y-2">
            <li
              *ngFor="let a of sortedAccounts()"
              class="flex items-center justify-between rounded-md px-2 py-2 text-sm transition hover:bg-slate-50"
            >
              <div class="flex items-center gap-2.5">
                <span
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md text-[10px] font-bold uppercase"
                  [ngClass]="accountBadgeClass(a.type)"
                >{{ accountInitial(a.type) }}</span>
                <div class="min-w-0">
                  <div class="truncate font-medium text-slate-900">{{ a.name }}</div>
                  <div class="truncate text-[11px] text-slate-500">
                    {{ a.bankName || a.type }} · {{ a.currency }}
                  </div>
                </div>
              </div>
              <div class="text-right font-semibold text-slate-900">
                {{ formatNumber(a.currentBalance ?? a.initialBalance) }}
              </div>
            </li>
          </ul>
        </div>

        <!-- Top clients this month -->
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold text-slate-900">Top clients</div>
              <div class="text-xs text-slate-500">Revenue this month</div>
            </div>
            <a routerLink="/reports" class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900">All →</a>
          </div>
          <div *ngIf="topClients.length === 0" class="mt-4 text-xs text-slate-500">No revenue recorded this month.</div>
          <ul *ngIf="topClients.length > 0" class="mt-3 space-y-2.5">
            <li *ngFor="let c of topClients; let i = index" class="space-y-1">
              <div class="flex items-center justify-between text-sm">
                <span class="truncate font-medium text-slate-900">
                  {{ i + 1 }}. {{ c.clientName || 'Unknown' }}
                </span>
                <span class="ml-2 font-semibold text-slate-900">{{ formatMoney(c.total, c.currency) }}</span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div class="h-full bg-indigo-500 transition-all" [style.width.%]="clientBarWidth(c.total)"></div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Budget utilization -->
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="flex items-center justify-between">
            <div>
              <div class="text-sm font-semibold text-slate-900">Spending by category</div>
              <div class="text-xs text-slate-500">Budget utilization this month</div>
            </div>
            <a routerLink="/budgets" class="text-[10px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900">Budgets →</a>
          </div>
          <div *ngIf="budgetRows().length === 0" class="mt-4 text-xs text-slate-500">No expenses recorded yet.</div>
          <ul *ngIf="budgetRows().length > 0" class="mt-3 space-y-3">
            <li *ngFor="let r of budgetRows()" class="space-y-1">
              <div class="flex items-center justify-between text-sm">
                <span class="truncate font-medium text-slate-900">{{ r.categoryName }}</span>
                <span class="ml-2 text-xs text-slate-600">
                  <span class="font-semibold" [ngClass]="usageTextClass(r.usage)">{{ formatMoney(r.spent, r.currency) }}</span>
                  <span *ngIf="r.budget > 0" class="text-slate-400"> / {{ formatNumber(r.budget) }}</span>
                </span>
              </div>
              <div class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  class="h-full transition-all"
                  [ngClass]="usageBarClass(r.usage)"
                  [style.width.%]="Math.min(100, r.usage * 100)"
                ></div>
              </div>
              <div *ngIf="r.budget > 0" class="text-[11px] text-slate-500">
                {{ (r.usage * 100).toFixed(0) }}% of budget used
              </div>
            </li>
          </ul>
        </div>
      </section>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly Math = Math;

  overview: DashboardOverview | null = null;
  financeOverview: FinanceOverview | null = null;
  plannedSummary: PlannedIncomeSummary | null = null;
  plannedAlerts: PlannedIncomeAlerts | null = null;
  recurringAlerts: RecurringExpenseAlerts | null = null;
  loanAlerts: LoanAlerts | null = null;
  subscriptionAlerts: SubscriptionAlerts | null = null;
  budgetAlerts: BudgetAlertItem[] = [];

  accounts: AccountItem[] = [];
  trends: TrendItem[] = [];
  topClients: FinanceByClientItem[] = [];
  topCategories: FinanceByCategoryItem[] = [];

  overdueContracts: ContractItem[] = [];
  dueSoonContracts: ContractItem[] = [];
  activeContractsCount = 0;
  pendingEstimatesCount = 0;

  private recurringOccurrences: RecurringExpenseOccurrence[] = [];
  private plannedOccurrences: PlannedIncomeOccurrence[] = [];

  private readonly fxRate = environment.fxRateUsdToNio || 36;

  constructor(
    private readonly authService: AuthService,
    private readonly reportsApi: ReportsApiService,
    private readonly contractsApi: ContractsApiService,
    private readonly financeApi: FinanceApiService,
    private readonly accountsApi: AccountsApiService,
    private readonly plannedIncomesApi: PlannedIncomesApiService,
    private readonly recurringExpensesApi: RecurringExpensesApiService,
    private readonly notificationsApi: NotificationsApiService,
    private readonly estimatesApi: EstimatesApiService,
  ) {}

  ngOnInit() {
    this.loadAll();
  }

  private loadAll() {
    const month = this.currentMonthIso();
    const today = new Date();
    const in30 = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

    this.reportsApi.dashboardOverview().subscribe({ next: (d) => (this.overview = d) });
    this.financeApi.overview().subscribe({ next: (d) => (this.financeOverview = d) });
    this.accountsApi.list({ isActive: true, includeBalance: true }).subscribe({
      next: (items) => (this.accounts = items),
    });
    this.plannedIncomesApi.summary(month).subscribe({ next: (d) => (this.plannedSummary = d) });
    this.plannedIncomesApi.occurrences(month).subscribe({
      next: (items) => (this.plannedOccurrences = items),
    });
    this.recurringExpensesApi.occurrences(month).subscribe({
      next: (items) => (this.recurringOccurrences = items),
    });
    this.notificationsApi.getNotifications(month).subscribe({
      next: (data) => {
        this.plannedAlerts = data.plannedIncome;
        this.recurringAlerts = data.recurringExpense;
        this.loanAlerts = data.loans;
        this.subscriptionAlerts = data.subscriptions;
        this.budgetAlerts = data.budget?.items ?? [];
      },
    });
    this.reportsApi.trends(6).subscribe({
      next: (items) => {
        this.trends = items;
        this.buildCashflowChart();
      },
    });

    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    this.financeApi.byCategory({ month: today.getMonth() + 1, year: today.getFullYear() }).subscribe({
      next: (items) => {
        this.topCategories = items
          .filter((i) => i.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
      },
    });
    this.financeApi.byClient({ from: this.toIsoDate(monthStart), to: this.toIsoDate(monthEnd) }).subscribe({
      next: (items) => {
        this.topClients = items
          .filter((i) => i.total > 0)
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
      },
    });

    this.contractsApi.list({ status: 'active', limit: 200 }).subscribe({
      next: (response) => {
        this.activeContractsCount = response.total;
        const todayIso = this.toIsoDate(today);
        const in30Iso = this.toIsoDate(in30);
        this.overdueContracts = response.items
          .filter((c) => (c.balance || 0) > 0 && c.endDate && c.endDate < todayIso)
          .sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''));
        this.dueSoonContracts = response.items
          .filter((c) => (c.balance || 0) > 0 && c.endDate && c.endDate >= todayIso && c.endDate <= in30Iso)
          .sort((a, b) => (a.endDate || '').localeCompare(b.endDate || ''));
      },
    });

    this.estimatesApi.list({ limit: 200 }).subscribe({
      next: (response) => {
        this.pendingEstimatesCount = response.items.filter(
          (e) => e.status === 'draft' || e.status === 'sent',
        ).length;
      },
    });
  }

  // ---- header
  firstName() {
    const name = this.authService.user()?.name || '';
    return name.split(' ')[0] || '';
  }
  greeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }
  todayLabel() {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }
  monthLabel() {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // ---- balances
  balanceUsd() {
    return this.financeOverview?.balanceUsd ?? 0;
  }
  balanceNio() {
    return this.financeOverview?.balanceNio ?? 0;
  }
  totalCashUsdEquivalent() {
    return this.balanceUsd() + this.balanceNio() / this.fxRate;
  }
  paidThisMonthUsdEq() {
    return (this.overview?.totalPaidThisMonthUsd ?? 0) + (this.overview?.totalPaidThisMonthNio ?? 0) / this.fxRate;
  }
  totalOutstandingUsdEq() {
    return (this.overview?.totalReceivableUsd ?? 0) + (this.overview?.totalReceivableNio ?? 0) / this.fxRate;
  }

  // ---- MoM change
  incomeMoMChange() {
    if (this.trends.length < 2) return 0;
    const current = this.trends[this.trends.length - 1];
    const prior = this.trends[this.trends.length - 2];
    const cur = (current.totalPaidUsd ?? 0) + (current.totalPaidNio ?? 0) / this.fxRate;
    const pri = (prior.totalPaidUsd ?? 0) + (prior.totalPaidNio ?? 0) / this.fxRate;
    if (pri === 0) return cur > 0 ? 100 : 0;
    return ((cur - pri) / pri) * 100;
  }

  // ---- confirmation rate
  plannedConfirmationRate() {
    const totals = this.plannedSummary?.totals;
    if (!totals) return 0;
    const planned = totals.plannedUsd + totals.plannedNio / this.fxRate;
    const confirmed = totals.confirmedUsd + totals.confirmedNio / this.fxRate;
    if (planned === 0) return 0;
    return Math.min(100, Math.round((confirmed / planned) * 100));
  }

  // ---- actions
  actionGroups(): ActionGroup[] {
    const groups: ActionGroup[] = [];
    if ((this.plannedAlerts?.count ?? 0) > 0) {
      groups.push({
        key: 'planned',
        label: 'Planned incomes overdue',
        count: this.plannedAlerts!.count,
        amountUsd: this.sumOccurrencesUsd(this.plannedAlerts!.items),
        tone: 'danger',
        link: '/planned-income',
      });
    }
    if ((this.recurringAlerts?.count ?? 0) > 0) {
      groups.push({
        key: 'recurring',
        label: 'Recurring expenses overdue',
        count: this.recurringAlerts!.count,
        amountUsd: this.sumOccurrencesUsd(this.recurringAlerts!.items),
        tone: 'danger',
        link: '/recurring-expenses',
      });
    }
    if ((this.loanAlerts?.count ?? 0) > 0) {
      groups.push({
        key: 'loans',
        label: 'Loan payments due',
        count: this.loanAlerts!.count,
        amountUsd: this.sumOccurrencesUsd(this.loanAlerts!.items),
        tone: 'danger',
        link: '/loans',
      });
    }
    if ((this.subscriptionAlerts?.count ?? 0) > 0) {
      groups.push({
        key: 'subscriptions',
        label: 'Subscriptions overdue',
        count: this.subscriptionAlerts!.count,
        amountUsd: this.sumOccurrencesUsd(this.subscriptionAlerts!.items),
        tone: 'warning',
        link: '/subscriptions',
      });
    }
    if (this.budgetAlerts.length > 0) {
      groups.push({
        key: 'budgets',
        label: 'Budget categories over threshold',
        count: this.budgetAlerts.length,
        amountUsd: this.budgetAlerts.reduce(
          (s, b) => s + (b.currency === 'USD' ? b.spent : b.spent / this.fxRate),
          0,
        ),
        tone: 'warning',
        link: '/budgets',
      });
    }
    if (this.overdueContracts.length > 0) {
      groups.push({
        key: 'contracts',
        label: 'Contracts past due',
        count: this.overdueContracts.length,
        amountUsd: this.overdueContracts.reduce(
          (s, c) => s + (c.currency === 'USD' ? c.balance || 0 : (c.balance || 0) / this.fxRate),
          0,
        ),
        tone: 'danger',
        link: '/contracts',
      });
    }
    return groups;
  }

  totalActions() {
    return this.actionGroups().reduce((s, g) => s + g.count, 0);
  }

  private sumOccurrencesUsd(
    items: Array<PlannedIncomeOccurrence | RecurringExpenseOccurrence | LoanPaymentOccurrence | SubscriptionOccurrence>,
  ) {
    return items.reduce(
      (s, i) => s + (i.currency === 'USD' ? i.amount : i.amount / this.fxRate),
      0,
    );
  }

  // ---- upcoming this week
  upcomingThisWeek(): UpcomingItem[] {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const items: UpcomingItem[] = [];

    for (const o of this.plannedOccurrences) {
      if (o.status !== 'planned') continue;
      const d = new Date(o.date);
      if (d >= start && d <= end) {
        items.push({
          name: this.refName(o.plannedIncomeId) || 'Planned income',
          date: o.date,
          amount: o.amount,
          currency: o.currency,
          flow: 'in',
          source: 'planned-income',
        });
      }
    }
    for (const o of this.recurringOccurrences) {
      if (o.status !== 'planned') continue;
      const d = new Date(o.date);
      if (d >= start && d <= end) {
        items.push({
          name: this.refName(o.recurringExpenseId) || 'Recurring expense',
          date: o.date,
          amount: o.amount,
          currency: o.currency,
          flow: 'out',
          source: 'recurring-expense',
        });
      }
    }

    return items.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }

  // ---- cashflow chart (ApexCharts)
  cashflowChart: CashflowChartOptions | null = null;

  private monthIncome(t: TrendItem) {
    return (t.totalPaidUsd ?? 0) + (t.totalPaidNio ?? 0) / this.fxRate;
  }
  private monthReceivable(t: TrendItem) {
    return (t.totalReceivableUsd ?? 0) + (t.totalReceivableNio ?? 0) / this.fxRate;
  }
  avgIncome() {
    if (this.trends.length === 0) return 0;
    return this.trends.reduce((s, t) => s + this.monthIncome(t), 0) / this.trends.length;
  }
  totalReceived6m() {
    return this.trends.reduce((s, t) => s + this.monthIncome(t), 0);
  }
  bestMonth() {
    if (this.trends.length === 0) return '—';
    const best = [...this.trends].sort((a, b) => this.monthIncome(b) - this.monthIncome(a))[0];
    return this.formatMonth(best.month);
  }
  private formatMonth(iso: string) {
    const [year, month] = iso.split('-').map(Number);
    return new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-US', { month: 'short' });
  }

  private buildCashflowChart() {
    if (this.trends.length === 0) {
      this.cashflowChart = null;
      return;
    }
    const categories = this.trends.map((t) => this.formatMonth(t.month));
    const received = this.trends.map((t) => Math.round(this.monthIncome(t) * 100) / 100);
    const outstanding = this.trends.map((t) => Math.round(this.monthReceivable(t) * 100) / 100);
    const avg = Math.round(this.avgIncome() * 100) / 100;

    void avg;

    this.cashflowChart = {
      series: [
        { name: 'Received', data: received },
        { name: 'Outstanding', data: outstanding },
      ],
      chart: {
        type: 'line',
        height: 340,
        fontFamily: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
        animations: { enabled: true, speed: 500 },
      },
      colors: ['#2563eb', '#22d3ee'],
      plotOptions: {},
      dataLabels: { enabled: false },
      stroke: {
        curve: 'smooth',
        width: 3,
        lineCap: 'round',
      },
      fill: { type: 'solid', opacity: 1 },
      markers: {
        size: 4,
        strokeWidth: 0,
        hover: { size: 6 },
      },
      xaxis: {
        categories,
        title: {
          text: 'Months',
          style: { color: '#0f172a', fontSize: '12px', fontWeight: 600 },
        },
        labels: {
          style: { colors: '#64748b', fontSize: '11px', fontWeight: 500 },
          rotate: 0,
        },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        title: {
          text: 'Amount (USD)',
          style: { color: '#0f172a', fontSize: '12px', fontWeight: 600 },
        },
        labels: {
          formatter: (val: number) => (val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val.toFixed(0)),
          style: { colors: '#94a3b8', fontSize: '11px' },
        },
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4,
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } },
        padding: { left: 16, right: 16, top: 0, bottom: 8 },
      },
      legend: {
        position: 'bottom',
        horizontalAlign: 'left',
        markers: { size: 6, strokeWidth: 0, shape: 'circle' } as any,
        itemMargin: { horizontal: 18, vertical: 4 },
        fontSize: '13px',
        fontWeight: 500,
        labels: { colors: '#0f172a' },
        offsetY: 6,
      },
      tooltip: {
        shared: true,
        intersect: false,
        y: { formatter: (val: number) => `USD ${this.formatNumber(val)}` },
        theme: 'light',
      },
      annotations: {},
    };
  }

  // ---- insights
  sortedAccounts() {
    return [...this.accounts]
      .sort((a, b) => (b.currentBalance ?? b.initialBalance) - (a.currentBalance ?? a.initialBalance))
      .slice(0, 6);
  }
  accountInitial(type: string) {
    if (type === 'bank') return 'BK';
    if (type === 'paypal') return 'PP';
    if (type === 'cash') return '$';
    return '··';
  }
  accountBadgeClass(type: string) {
    switch (type) {
      case 'bank':
        return 'bg-indigo-50 text-indigo-700';
      case 'paypal':
        return 'bg-sky-50 text-sky-700';
      case 'cash':
        return 'bg-emerald-50 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }
  clientBarWidth(amount: number) {
    const max = Math.max(...this.topClients.map((c) => c.total), 1);
    return (amount / max) * 100;
  }
  budgetRows(): BudgetRow[] {
    return this.topCategories.map((c) => {
      const usage = c.budget > 0 ? c.total / c.budget : 0;
      return {
        categoryName: c.categoryName || '—',
        spent: c.total,
        budget: c.budget,
        currency: c.currency,
        usage,
      };
    });
  }
  usageBarClass(usage: number) {
    if (usage > 1) return 'bg-rose-500';
    if (usage > 0.8) return 'bg-amber-500';
    return 'bg-emerald-500';
  }
  usageTextClass(usage: number) {
    if (usage > 1) return 'text-rose-700';
    if (usage > 0.8) return 'text-amber-700';
    return 'text-slate-900';
  }

  // ---- contract helpers
  getClientName(item: ContractItem) {
    if (!item.clientId) return '—';
    return typeof item.clientId === 'string' ? item.clientId : item.clientId.name || '—';
  }
  getServiceName(item: ContractItem) {
    if (!item.serviceId) return '—';
    return typeof item.serviceId === 'string' ? item.serviceId : item.serviceId.name || '—';
  }
  daysUntil(date?: string) {
    if (!date) return 0;
    const d = new Date(date).getTime();
    return Math.max(0, Math.ceil((d - Date.now()) / (24 * 60 * 60 * 1000)));
  }
  daysAgo(date?: string) {
    if (!date) return 0;
    const d = new Date(date).getTime();
    return Math.max(0, Math.ceil((Date.now() - d) / (24 * 60 * 60 * 1000)));
  }

  // ---- generic helpers
  private refName(ref: string | { _id: string; name: string } | undefined): string {
    if (!ref) return '';
    return typeof ref === 'string' ? '' : ref.name || '';
  }
  private currentMonthIso() {
    return new Date().toISOString().slice(0, 7);
  }
  private toIsoDate(d: Date) {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }
  formatShortDate(date: string) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  formatNumber(n: number) {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0);
  }
  formatMoney(amount: number, currency: 'USD' | 'NIO' = 'USD') {
    return `${currency} ${this.formatNumber(amount)}`;
  }
}
