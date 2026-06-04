import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { PlannedIncomesApiService } from '../../core/services/planned-incomes-api.service';
import { ReportsApiService } from '../../core/services/reports-api.service';
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
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="text-2xl font-semibold">Planned income</div>
          <div class="text-sm text-slate-500">Monthly salary planning and confirmation</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          New planned income
        </button>
      </div>

      <div *ngIf="alerts?.count" class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
        <div class="font-semibold text-amber-900">
          {{ alerts?.count }} planned income item(s) are overdue this month
        </div>
        <div class="mt-2 text-amber-800">
          Confirm or omit them to keep your plan accurate.
        </div>
      </div>

      <div class="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4">
        <div>
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500">Month</label>
          <input
            type="month"
            [(ngModel)]="selectedMonth"
            class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div class="lg:col-span-3 flex items-end">
          <button
            class="w-full rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
            (click)="loadMonth()"
          >
            Refresh
          </button>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="text-sm font-semibold text-slate-800">Projected income (month)</div>
          <label class="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" [(ngModel)]="includeContracts" />
            Include contract receivables
          </label>
        </div>
        <div class="mt-3 grid gap-4 md:grid-cols-3">
          <div class="rounded-lg border border-slate-200 p-4">
            <div class="text-xs uppercase tracking-wide text-slate-500">Planned income</div>
            <div class="text-lg font-semibold">
              {{ formatMoney(projection?.plannedUsd ?? 0, 'USD') }}
            </div>
            <div class="text-xs text-slate-500">
              {{ formatMoney(projection?.plannedNio ?? 0, 'NIO') }}
            </div>
          </div>
          <div class="rounded-lg border border-slate-200 p-4">
            <div class="text-xs uppercase tracking-wide text-slate-500">Contract receivables</div>
            <div class="text-lg font-semibold">
              {{ formatMoney(projection?.contractUsd ?? 0, 'USD') }}
            </div>
            <div class="text-xs text-slate-500">
              {{ formatMoney(projection?.contractNio ?? 0, 'NIO') }}
            </div>
          </div>
          <div class="rounded-lg border border-slate-200 p-4">
            <div class="text-xs uppercase tracking-wide text-slate-500">Projected total</div>
            <div class="text-lg font-semibold">
              {{ formatMoney(projectedTotalUsd(), 'USD') }}
            </div>
            <div class="text-xs text-slate-500">
              {{ formatMoney(projectedTotalNio(), 'NIO') }}
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-500">Planned USD</div>
          <div class="text-2xl font-semibold">
            {{ formatMoney(summary?.totals?.plannedUsd ?? 0, 'USD') }}
          </div>
          <div class="text-xs text-slate-500">
            Confirmed: {{ formatMoney(summary?.totals?.confirmedUsd ?? 0, 'USD') }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-500">Planned NIO</div>
          <div class="text-2xl font-semibold">
            {{ formatMoney(summary?.totals?.plannedNio ?? 0, 'NIO') }}
          </div>
          <div class="text-xs text-slate-500">
            Confirmed: {{ formatMoney(summary?.totals?.confirmedNio ?? 0, 'NIO') }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-500">Variance USD</div>
          <div class="text-2xl font-semibold">
            {{ formatMoney(summary?.totals?.varianceUsd ?? 0, 'USD') }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-500">Variance NIO</div>
          <div class="text-2xl font-semibold">
            {{ formatMoney(summary?.totals?.varianceNio ?? 0, 'NIO') }}
          </div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-slate-800">Plan vs real by account</div>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Account</th>
              <th class="py-2">Planned</th>
              <th class="py-2">Confirmed</th>
              <th class="py-2">Variance</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of summary?.byAccount || []" class="border-t border-slate-100">
              <td class="py-3">{{ item.accountName }}</td>
              <td class="py-3">{{ formatMoney(item.plannedTotal, item.currency) }}</td>
              <td class="py-3">{{ formatMoney(item.confirmedTotal, item.currency) }}</td>
              <td class="py-3">{{ formatMoney(item.variance, item.currency) }}</td>
            </tr>
            <tr *ngIf="(summary?.byAccount?.length || 0) === 0">
              <td colspan="4" class="py-4 text-center text-sm text-slate-500">No data</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-slate-800">Planned income occurrences</div>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Date</th>
              <th class="py-2">Name</th>
              <th class="py-2">Account</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Received</th>
              <th class="py-2">Fees</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of occurrences" class="border-t border-slate-100">
              <td class="py-3">{{ formatDate(item.date) }}</td>
              <td class="py-3">{{ resolvePlannedName(item) }}</td>
              <td class="py-3">{{ resolveAccountName(item) }}</td>
              <td class="py-3">{{ formatMoney(item.amount, item.currency) }}</td>
              <td class="py-3">
                {{ formatMoney(item.receivedAmount ?? 0, item.currency) }}
              </td>
              <td class="py-3">
                {{ formatMoney(item.feeAmount ?? 0, item.currency) }}
              </td>
              <td class="py-3">
                <span
                  class="rounded-full px-2 py-1 text-xs"
                  [ngClass]="{
                    'bg-slate-100 text-slate-600': item.status === 'planned',
                    'bg-emerald-100 text-emerald-700': item.status === 'confirmed',
                    'bg-rose-100 text-rose-700': item.status === 'omitted'
                  }"
                >
                  {{ item.status }}
                </span>
              </td>
              <td class="py-3 text-right">
                <button
                  class="text-xs text-slate-700"
                  (click)="openConfirm(item)"
                  [disabled]="item.status !== 'planned' || isWorking"
                >
                  Confirm
                </button>
                <button
                  class="ml-3 text-xs text-slate-400"
                  (click)="omit(item)"
                  [disabled]="item.status !== 'planned' || isWorking"
                >
                  Omit
                </button>
              </td>
            </tr>
            <tr *ngIf="occurrences.length === 0">
              <td colspan="8" class="py-4 text-center text-sm text-slate-500">No occurrences</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-slate-800">Planned income sources</div>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Name</th>
              <th class="py-2">Account</th>
              <th class="py-2">Category</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Days</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of plannedIncomes" class="border-t border-slate-100">
              <td class="py-3">{{ item.name }}</td>
              <td class="py-3">{{ resolveAccountName(item) }}</td>
              <td class="py-3">{{ resolveCategoryName(item) }}</td>
              <td class="py-3">{{ formatMoney(item.amount, item.currency) }}</td>
              <td class="py-3">{{ item.daysOfMonth.join(', ') }}</td>
              <td class="py-3">
                <span
                  class="rounded-full px-2 py-1 text-xs"
                  [ngClass]="{
                    'bg-emerald-100 text-emerald-700': item.isActive,
                    'bg-slate-100 text-slate-600': !item.isActive
                  }"
                >
                  {{ item.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="py-3 text-right">
                <button class="text-xs text-slate-700" (click)="openEdit(item)">Edit</button>
                <button class="ml-3 text-xs text-slate-400" (click)="remove(item)">Disable</button>
              </td>
            </tr>
            <tr *ngIf="plannedIncomes.length === 0">
              <td colspan="7" class="py-4 text-center text-sm text-slate-500">No planned income</td>
            </tr>
          </tbody>
        </table>
      </div>
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

  remove(item: PlannedIncomeItem) {
    this.plannedIncomesApi.remove(item._id).subscribe({
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
}
