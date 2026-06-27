import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { PlannedIncomesApiService } from '../../core/services/planned-incomes-api.service';
import { ReportsApiService } from '../../core/services/reports-api.service';
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';
import {
  PlannedIncomeAlerts,
  PlannedIncomeItem,
  PlannedIncomeOccurrence,
  PlannedIncomeSummary,
} from '../../core/models/planned-income.model';
import { ProjectionItem } from '../../core/models/report.model';
import { AccountItem } from '../../core/models/account.model';
import { CategoryItem } from '../../core/models/category.model';

@Component({
  selector: 'app-planned-incomes',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ActionMenuComponent],
  template: `
    <div class="space-y-6">
      <!-- HERO -->
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-slate-900">Planned income</div>
          <div class="mt-1 text-sm text-slate-500">
            Recurring salaries, retainers, royalties — track expected vs received for the month.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="month"
            [(ngModel)]="selectedMonth"
            (ngModelChange)="loadMonth()"
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            (click)="openCreate()"
            class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white"
          >
            + Add source
          </button>
        </div>
      </header>

      <!-- ALERT BANNER -->
      <div
        *ngIf="alerts?.count"
        class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
      >
        <div class="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">!</div>
        <div class="flex-1">
          <div class="text-sm font-semibold text-amber-900">
            {{ alerts?.count }} planned income{{ alerts?.count === 1 ? '' : 's' }} overdue
          </div>
          <div class="text-xs text-amber-800">
            Confirm what you received, or omit if it won't arrive. Keeps your plan accurate.
          </div>
        </div>
      </div>

      <!-- MONTH OVERVIEW (single hero card) -->
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {{ monthLabel() }} · {{ plannedIncomes.length }} {{ plannedIncomes.length === 1 ? 'source' : 'sources' }}
            </div>
            <div class="mt-2 text-3xl font-semibold text-slate-900">
              {{ formatMoney(summary?.totals?.plannedUsd ?? 0, 'USD') }}
            </div>
            <div class="text-sm text-slate-500">
              + {{ formatMoney(summary?.totals?.plannedNio ?? 0, 'NIO') }} expected
            </div>
          </div>
          <div class="md:text-right">
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Confirmed so far</div>
            <div class="mt-2 text-3xl font-semibold text-emerald-700">
              {{ formatMoney(summary?.totals?.confirmedUsd ?? 0, 'USD') }}
            </div>
            <div class="text-sm text-slate-500">
              + {{ formatMoney(summary?.totals?.confirmedNio ?? 0, 'NIO') }} received
            </div>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="mt-6">
          <div class="flex items-center justify-between text-xs text-slate-600">
            <span>
              {{ confirmationProgress().confirmed }} of {{ confirmationProgress().total }} occurrences confirmed
            </span>
            <span class="font-semibold text-slate-900">{{ confirmationProgress().percent }}%</span>
          </div>
          <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full bg-emerald-500 transition-all"
              [style.width.%]="confirmationProgress().percent"
            ></div>
          </div>
        </div>

        <!-- Optional projection (contract receivables) -->
        <div class="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <label class="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" [(ngModel)]="includeContracts" />
            Include contract receivables in projection
          </label>
          <div *ngIf="includeContracts && projection" class="text-xs text-slate-600">
            Projected total:
            <span class="font-semibold text-slate-900">{{ formatMoney(projectedTotalUsd(), 'USD') }}</span>
            <span class="text-slate-400"> · {{ formatMoney(projectedTotalNio(), 'NIO') }}</span>
          </div>
        </div>
      </section>

      <!-- SCHEDULE -->
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-5 py-4">
          <div class="text-sm font-semibold text-slate-900">Schedule</div>
          <div class="text-xs text-slate-500">
            Confirm what was received, omit if it won't arrive.
          </div>
        </div>

        <!-- Overdue -->
        <ng-container *ngIf="grouped().overdue.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 bg-rose-50/40 px-5 py-2">
            <span class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">Overdue</span>
            <span class="text-xs text-slate-500">{{ grouped().overdue.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().overdue" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium text-slate-900">{{ resolvePlannedName(o) }}</span>
                  <span class="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                    {{ daysOverdue(o.date) }}d overdue
                  </span>
                </div>
                <div class="text-xs text-slate-500">
                  Due {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}
                </div>
              </div>
              <div class="font-semibold text-slate-900">{{ formatMoney(o.amount, o.currency) }}</div>
              <div class="flex items-center gap-2">
                <button
                  (click)="openConfirm(o)"
                  [disabled]="isWorking"
                  class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  (click)="omit(o)"
                  [disabled]="isWorking"
                  class="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  Omit
                </button>
              </div>
            </li>
          </ul>
        </ng-container>

        <!-- This week -->
        <ng-container *ngIf="grouped().thisWeek.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 bg-amber-50/40 px-5 py-2">
            <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">This week</span>
            <span class="text-xs text-slate-500">{{ grouped().thisWeek.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().thisWeek" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="min-w-0 flex-1">
                <div class="font-medium text-slate-900">{{ resolvePlannedName(o) }}</div>
                <div class="text-xs text-slate-500">
                  Due {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}
                </div>
              </div>
              <div class="font-semibold text-slate-900">{{ formatMoney(o.amount, o.currency) }}</div>
              <div class="flex items-center gap-2">
                <button
                  (click)="openConfirm(o)"
                  [disabled]="isWorking"
                  class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  (click)="omit(o)"
                  [disabled]="isWorking"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Omit
                </button>
              </div>
            </li>
          </ul>
        </ng-container>

        <!-- Later this month -->
        <ng-container *ngIf="grouped().later.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 px-5 py-2">
            <span class="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">Later this month</span>
            <span class="text-xs text-slate-500">{{ grouped().later.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().later" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="min-w-0 flex-1">
                <div class="font-medium text-slate-900">{{ resolvePlannedName(o) }}</div>
                <div class="text-xs text-slate-500">
                  Due {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}
                </div>
              </div>
              <div class="font-semibold text-slate-900">{{ formatMoney(o.amount, o.currency) }}</div>
              <div class="flex items-center gap-2">
                <button
                  (click)="openConfirm(o)"
                  [disabled]="isWorking"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Confirm
                </button>
                <button
                  (click)="omit(o)"
                  [disabled]="isWorking"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700 disabled:opacity-50"
                >
                  Omit
                </button>
              </div>
            </li>
          </ul>
        </ng-container>

        <!-- Confirmed -->
        <ng-container *ngIf="grouped().confirmed.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 bg-emerald-50/40 px-5 py-2">
            <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Confirmed</span>
            <span class="text-xs text-slate-500">{{ grouped().confirmed.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().confirmed" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <span class="text-emerald-600">✓</span>
                <div class="min-w-0">
                  <div class="font-medium text-slate-900">{{ resolvePlannedName(o) }}</div>
                  <div class="text-xs text-slate-500">
                    Received {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}
                  </div>
                </div>
              </div>
              <div class="text-right">
                <div class="font-semibold text-emerald-700">
                  {{ formatMoney(o.receivedAmount ?? o.amount, o.currency) }}
                </div>
                <div *ngIf="(o.feeAmount ?? 0) > 0" class="text-[11px] text-rose-600">
                  Fees: {{ formatMoney(o.feeAmount ?? 0, o.currency) }}
                </div>
              </div>
            </li>
          </ul>
        </ng-container>

        <!-- Omitted -->
        <ng-container *ngIf="grouped().omitted.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 px-5 py-2">
            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">Omitted</span>
            <span class="text-xs text-slate-500">{{ grouped().omitted.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().omitted" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="min-w-0 flex-1 text-slate-400">
                <div class="line-through">{{ resolvePlannedName(o) }}</div>
                <div class="text-xs">{{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}</div>
              </div>
              <div class="text-slate-400 line-through">{{ formatMoney(o.amount, o.currency) }}</div>
              <button
                (click)="reactivate(o)"
                [disabled]="isWorking"
                class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                title="Restore this occurrence to planned status"
              >
                Reactivate
              </button>
            </li>
          </ul>
        </ng-container>

        <div *ngIf="occurrences.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
          No planned income for this month. Add a recurring source below.
        </div>
      </section>

      <!-- BY ACCOUNT -->
      <section *ngIf="(summary?.byAccount?.length || 0) > 0" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="text-sm font-semibold text-slate-900">By account</div>
        <div class="mt-4 space-y-4">
          <div *ngFor="let a of summary?.byAccount || []">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-slate-900">{{ a.accountName }}</span>
              <span class="text-slate-600">
                <span class="font-semibold text-emerald-700">{{ formatMoney(a.confirmedTotal, a.currency) }}</span>
                <span class="text-slate-400"> / {{ formatMoney(a.plannedTotal, a.currency) }}</span>
              </span>
            </div>
            <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div class="h-full bg-emerald-500 transition-all" [style.width.%]="accountPercent(a)"></div>
            </div>
            <div *ngIf="a.variance !== 0" class="mt-1 text-[11px]"
              [ngClass]="a.variance > 0 ? 'text-rose-600' : 'text-emerald-600'">
              {{ a.variance > 0 ? 'Missing' : 'Surplus' }} {{ formatMoney(absVariance(a.variance), a.currency) }}
            </div>
          </div>
        </div>
      </section>

      <!-- RECURRING SOURCES (config) -->
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div class="text-sm font-semibold text-slate-900">Recurring sources</div>
            <div class="text-xs text-slate-500">
              Templates that generate planned occurrences each month.
            </div>
          </div>
          <button
            (click)="openCreate()"
            class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
          >
            + Add source
          </button>
        </div>

        <div *ngIf="plannedIncomes.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
          No recurring sources yet. Add one to start tracking planned income.
        </div>

        <ul *ngIf="plannedIncomes.length > 0" class="divide-y divide-slate-100">
          <li *ngFor="let s of plannedIncomes" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-slate-900">{{ s.name }}</span>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  [ngClass]="s.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                  {{ s.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <div class="mt-1 text-xs text-slate-500">
                {{ resolveAccountName(s) }} · {{ resolveCategoryName(s) }} · day{{ s.daysOfMonth.length === 1 ? '' : 's' }} {{ s.daysOfMonth.join(', ') }}
              </div>
            </div>
            <div class="text-right text-sm font-semibold text-slate-900">
              {{ formatMoney(s.amount, s.currency) }}
            </div>
            <app-action-menu [items]="sourceActions(s)" />
          </li>
        </ul>
      </section>
    </div>

    <div
      *ngIf="isModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">
            {{ editing ? 'Edit planned income' : 'New planned income' }}
          </div>
          <button class="text-slate-400" (click)="closeModal()">X</button>
        </div>

        <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="save()">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
            <input
              formControlName="name"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Account</label>
              <select
                formControlName="accountId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                (change)="syncCurrency()"
              >
                <option value="">Select account</option>
                <option *ngFor="let account of accounts" [value]="account._id">
                  {{ account.name }} ({{ account.currency }})
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Category</label>
              <select
                formControlName="categoryId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select category</option>
                <option *ngFor="let category of categories" [value]="category._id">
                  {{ category.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</label>
              <input
                formControlName="amount"
                type="number"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Currency</label>
              <select
                formControlName="currency"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="USD">USD</option>
                <option value="NIO">NIO</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Days</label>
              <input
                formControlName="daysOfMonth"
                placeholder="15,30"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Notes</label>
            <textarea
              formControlName="notes"
              rows="3"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            ></textarea>
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" formControlName="isActive" />
            Active
          </label>

          <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm text-slate-500" (click)="closeModal()">
              Cancel
            </button>
            <button
              type="submit"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white"
              [disabled]="form.invalid || isSaving"
            >
              {{ isSaving ? 'Saving...' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      *ngIf="isConfirmModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">Confirm income</div>
          <button class="text-slate-400" (click)="closeConfirm()">X</button>
        </div>

        <form class="mt-4 space-y-4" [formGroup]="confirmForm" (ngSubmit)="confirmSubmit()">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Received amount
            </label>
            <input
              formControlName="receivedAmount"
              type="number"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Confirmation note
            </label>
            <textarea
              formControlName="note"
              rows="3"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            ></textarea>
          </div>

          <div class="text-xs text-slate-500">
            Fees will be calculated as planned amount minus received amount.
          </div>

          <div *ngIf="confirmError" class="text-sm text-red-600">{{ confirmError }}</div>

          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm text-slate-500" (click)="closeConfirm()">
              Cancel
            </button>
            <button
              type="submit"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white"
              [disabled]="confirmForm.invalid || isWorking"
            >
              {{ isWorking ? 'Saving...' : 'Confirm' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class PlannedIncomesComponent implements OnInit {
  plannedIncomes: PlannedIncomeItem[] = [];
  occurrences: PlannedIncomeOccurrence[] = [];
  summary: PlannedIncomeSummary | null = null;
  alerts: PlannedIncomeAlerts | null = null;
  projection: ProjectionItem | null = null;
  accounts: AccountItem[] = [];
  categories: CategoryItem[] = [];
  isModalOpen = false;
  isConfirmModalOpen = false;
  isSaving = false;
  isWorking = false;
  error = '';
  confirmError = '';
  editing: PlannedIncomeItem | null = null;
  confirmingOccurrence: PlannedIncomeOccurrence | null = null;
  includeContracts = true;
  form: FormGroup;
  confirmForm: FormGroup;
  selectedMonth = new Date().toISOString().slice(0, 7);

  constructor(
    private readonly fb: FormBuilder,
    private readonly plannedIncomesApi: PlannedIncomesApiService,
    private readonly reportsApi: ReportsApiService,
    private readonly accountsApi: AccountsApiService,
    private readonly categoriesApi: CategoriesApiService,
    private readonly confirmDialog: ConfirmService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0)]],
      currency: ['USD', [Validators.required]],
      accountId: ['', [Validators.required]],
      categoryId: ['', [Validators.required]],
      daysOfMonth: ['15,30', [Validators.required]],
      notes: [''],
      isActive: [true],
    });
    this.confirmForm = this.fb.group({
      receivedAmount: [0, [Validators.required, Validators.min(0.01)]],
      note: [''],
    });
  }

  ngOnInit() {
    this.loadReferences();
    this.loadPlanned();
    this.loadMonth();
  }

  loadReferences() {
    this.accountsApi.list().subscribe({
      next: (items) => (this.accounts = items),
    });
    this.categoriesApi.list({ type: 'income' }).subscribe({
      next: (items) => (this.categories = items),
    });
  }

  loadPlanned() {
    this.plannedIncomesApi.list().subscribe({
      next: (items) => (this.plannedIncomes = items),
    });
  }

  loadMonth() {
    this.plannedIncomesApi.summary(this.selectedMonth).subscribe({
      next: (data) => (this.summary = data),
    });
    this.plannedIncomesApi.occurrences(this.selectedMonth).subscribe({
      next: (items) => (this.occurrences = items),
    });
    this.plannedIncomesApi.alerts(this.selectedMonth).subscribe({
      next: (data) => (this.alerts = data),
    });
    this.reportsApi.projections(this.selectedMonth).subscribe({
      next: (data) => (this.projection = data),
    });
  }

  openCreate() {
    this.editing = null;
    this.form.reset({
      name: '',
      amount: 0,
      currency: 'USD',
      accountId: '',
      categoryId: '',
      daysOfMonth: '15,30',
      notes: '',
      isActive: true,
    });
    this.isModalOpen = true;
  }

  sourceActions(item: PlannedIncomeItem): ActionMenuItem[] {
    return [
      { label: 'Edit', action: () => this.openEdit(item) },
      { label: item.isActive ? 'Disable' : 'Enable', action: () => this.toggleActive(item) },
      { label: 'Delete', action: () => this.remove(item), danger: true },
    ];
  }

  occurrenceActions(item: PlannedIncomeOccurrence): ActionMenuItem[] {
    const locked = item.status !== 'planned' || this.isWorking;
    return [
      { label: 'Confirm payment', action: () => this.openConfirm(item), disabled: locked },
      { label: 'Omit', action: () => this.omit(item), disabled: locked, danger: true },
    ];
  }

  openEdit(item: PlannedIncomeItem) {
    this.editing = item;
    this.form.reset({
      name: item.name,
      amount: item.amount,
      currency: item.currency,
      accountId: this.resolveAccountId(item),
      categoryId: this.resolveCategoryId(item),
      daysOfMonth: item.daysOfMonth.join(', '),
      notes: item.notes || '',
      isActive: item.isActive,
    });
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.error = '';
  }

  openConfirm(item: PlannedIncomeOccurrence) {
    this.confirmingOccurrence = item;
    this.confirmError = '';
    this.confirmForm.reset({
      receivedAmount: item.amount,
      note: item.confirmationNote || '',
    });
    this.isConfirmModalOpen = true;
  }

  closeConfirm() {
    this.isConfirmModalOpen = false;
    this.confirmError = '';
    this.confirmingOccurrence = null;
  }

  syncCurrency() {
    const accountId = this.form.value.accountId;
    const account = this.accounts.find((item) => item._id === accountId);
    if (account) {
      this.form.patchValue({ currency: account.currency });
    }
  }

  save() {
    if (this.form.invalid) {
      return;
    }

    this.isSaving = true;
    this.error = '';

    const days = this.parseDays(String(this.form.value.daysOfMonth || ''));
    const payload = {
      name: String(this.form.value.name || ''),
      amount: Number(this.form.value.amount || 0),
      currency: (this.form.value.currency || 'USD') as 'USD' | 'NIO',
      accountId: String(this.form.value.accountId || ''),
      categoryId: String(this.form.value.categoryId || ''),
      daysOfMonth: days,
      notes: String(this.form.value.notes || ''),
      isActive: Boolean(this.form.value.isActive),
    };

    const request = this.editing
      ? this.plannedIncomesApi.update(this.editing._id, payload)
      : this.plannedIncomesApi.create(payload);

    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.loadPlanned();
        this.loadMonth();
      },
      error: () => {
        this.error = 'Unable to save planned income';
        this.isSaving = false;
      },
    });
  }

  async remove(item: PlannedIncomeItem) {
    const confirmed = await this.confirmDialog.open({
      title: 'Delete planned income',
      message: `Delete "${item.name}"? Future planned occurrences will be removed. Confirmed occurrences stay intact. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.plannedIncomesApi.remove(item._id).subscribe({
      next: () => {
        this.plannedIncomes = this.plannedIncomes.filter((p) => p._id !== item._id);
        this.loadPlanned();
        this.loadMonth();
      },
      error: (err) => {
        const message = Array.isArray(err?.error?.message)
          ? err.error.message.join(', ')
          : err?.error?.message;
        this.error = message || 'Unable to delete planned income';
      },
    });
  }

  toggleActive(item: PlannedIncomeItem) {
    this.plannedIncomesApi.update(item._id, { isActive: !item.isActive }).subscribe({
      next: () => {
        this.loadPlanned();
        this.loadMonth();
      },
    });
  }

  confirm(item: PlannedIncomeOccurrence) {
    if (item.status !== 'planned') {
      return;
    }
    this.isWorking = true;
    this.plannedIncomesApi
      .confirmOccurrence(item._id, { receivedAmount: item.amount, note: item.confirmationNote })
      .subscribe({
        next: () => {
          this.isWorking = false;
          this.loadMonth();
        },
        error: () => {
          this.isWorking = false;
        },
      });
  }

  confirmSubmit() {
    if (this.confirmForm.invalid || !this.confirmingOccurrence) {
      return;
    }
    this.isWorking = true;
    this.confirmError = '';
    const payload = {
      receivedAmount: Number(this.confirmForm.value.receivedAmount ?? 0),
      note: String(this.confirmForm.value.note || ''),
    };

    this.plannedIncomesApi.confirmOccurrence(this.confirmingOccurrence._id, payload).subscribe({
      next: () => {
        this.isWorking = false;
        this.closeConfirm();
        this.loadMonth();
      },
      error: (error) => {
        const message = Array.isArray(error?.error?.message)
          ? error.error.message.join(', ')
          : error?.error?.message;
        this.confirmError = message || 'Unable to confirm income';
        this.isWorking = false;
      },
    });
  }

  omit(item: PlannedIncomeOccurrence) {
    if (item.status !== 'planned') {
      return;
    }
    this.isWorking = true;
    this.plannedIncomesApi.omitOccurrence(item._id).subscribe({
      next: () => {
        this.isWorking = false;
        this.loadMonth();
      },
      error: () => {
        this.isWorking = false;
      },
    });
  }

  reactivate(item: PlannedIncomeOccurrence) {
    if (item.status !== 'omitted') {
      return;
    }
    this.isWorking = true;
    this.plannedIncomesApi.reactivateOccurrence(item._id).subscribe({
      next: () => {
        this.isWorking = false;
        this.loadMonth();
      },
      error: () => {
        this.isWorking = false;
      },
    });
  }

  parseDays(raw: string) {
    return raw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => !Number.isNaN(value) && value > 0 && value <= 31);
  }

  resolveAccountId(item: PlannedIncomeItem) {
    return typeof item.accountId === 'string' ? item.accountId : item.accountId?._id || '';
  }

  resolveCategoryId(item: PlannedIncomeItem) {
    return typeof item.categoryId === 'string' ? item.categoryId : item.categoryId?._id || '';
  }

  resolveAccountName(item: PlannedIncomeItem | PlannedIncomeOccurrence) {
    const account = item.accountId as { _id: string; name: string } | string;
    return typeof account === 'string' ? account : account?.name || '';
  }

  resolveCategoryName(item: PlannedIncomeItem) {
    const category = item.categoryId as { _id: string; name: string } | string;
    return typeof category === 'string' ? category : category?.name || '';
  }

  resolvePlannedName(item: PlannedIncomeOccurrence) {
    const planned = item.plannedIncomeId as { _id: string; name: string } | string;
    return typeof planned === 'string' ? planned : planned?.name || '';
  }

  formatDate(value?: string) {
    if (!value) {
      return '-';
    }
    return new Date(value).toLocaleDateString();
  }

  formatMoney(amount: number, currency: 'USD' | 'NIO') {
    return `${currency} ${amount.toFixed(2)}`;
  }

  projectedTotalUsd() {
    if (!this.projection) {
      return 0;
    }
    return this.includeContracts ? this.projection.totalUsd : this.projection.plannedUsd;
  }

  projectedTotalNio() {
    if (!this.projection) {
      return 0;
    }
    return this.includeContracts ? this.projection.totalNio : this.projection.plannedNio;
  }

  // ----- new helpers for revamped UI -----
  monthLabel(): string {
    const [yearStr, monthStr] = this.selectedMonth.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (Number.isNaN(year) || Number.isNaN(monthIndex)) return this.selectedMonth;
    return new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  confirmationProgress() {
    const total = this.occurrences.length;
    const confirmed = this.occurrences.filter((o) => o.status === 'confirmed').length;
    const percent = total === 0 ? 0 : Math.round((confirmed / total) * 100);
    return { confirmed, total, percent };
  }

  daysOverdue(date?: string): number {
    if (!date) return 0;
    const d = new Date(date).getTime();
    if (Number.isNaN(d)) return 0;
    return Math.max(0, Math.floor((Date.now() - d) / (24 * 60 * 60 * 1000)));
  }

  grouped() {
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    const groups = {
      overdue: [] as PlannedIncomeOccurrence[],
      thisWeek: [] as PlannedIncomeOccurrence[],
      later: [] as PlannedIncomeOccurrence[],
      confirmed: [] as PlannedIncomeOccurrence[],
      omitted: [] as PlannedIncomeOccurrence[],
    };
    for (const o of this.occurrences) {
      const t = new Date(o.date).getTime();
      if (o.status === 'confirmed') groups.confirmed.push(o);
      else if (o.status === 'omitted') groups.omitted.push(o);
      else if (Number.isNaN(t)) groups.later.push(o);
      else if (t < now) groups.overdue.push(o);
      else if (t <= week) groups.thisWeek.push(o);
      else groups.later.push(o);
    }
    const byDate = (a: PlannedIncomeOccurrence, b: PlannedIncomeOccurrence) =>
      a.date.localeCompare(b.date);
    groups.overdue.sort(byDate);
    groups.thisWeek.sort(byDate);
    groups.later.sort(byDate);
    groups.confirmed.sort(byDate);
    groups.omitted.sort(byDate);
    return groups;
  }

  accountPercent(a: { plannedTotal: number; confirmedTotal: number }) {
    if (!a.plannedTotal) return 0;
    return Math.min(100, Math.round((a.confirmedTotal / a.plannedTotal) * 100));
  }

  absVariance(v: number) {
    return Math.abs(v);
  }

  formatShortDate(date?: string) {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
