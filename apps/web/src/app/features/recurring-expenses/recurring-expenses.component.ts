import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { RecurringExpensesApiService } from '../../core/services/recurring-expenses-api.service';
import {
  RecurringExpenseItem,
  RecurringExpenseOccurrence,
} from '../../core/models/recurring-expense.model';
import { AccountItem } from '../../core/models/account.model';
import { CategoryItem } from '../../core/models/category.model';

@Component({
  selector: 'app-recurring-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="text-2xl font-semibold">Recurring expenses</div>
          <div class="text-sm text-slate-500">Plan and confirm monthly expenses</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          New recurring expense
        </button>
      </div>

      <div class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4">
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

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-500">Planned total (USD)</div>
          <div class="text-lg font-semibold text-slate-900">
            {{ formatMoney(recurringPlannedTotal('USD'), 'USD') }}
          </div>
          <div class="text-xs text-slate-500">
            Remaining: {{ formatMoney(recurringRemainingTotal('USD'), 'USD') }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-500">Planned total (NIO)</div>
          <div class="text-lg font-semibold text-slate-900">
            {{ formatMoney(recurringPlannedTotal('NIO'), 'NIO') }}
          </div>
          <div class="text-xs text-slate-500">
            Remaining: {{ formatMoney(recurringRemainingTotal('NIO'), 'NIO') }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-500">Confirmed payments</div>
          <div class="text-lg font-semibold text-slate-900">
            {{ formatMoney(recurringConfirmedTotal('USD'), 'USD') }}
          </div>
          <div class="text-xs text-slate-500">
            {{ formatMoney(recurringConfirmedTotal('NIO'), 'NIO') }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-500">Pending count</div>
          <div class="text-2xl font-semibold text-slate-900">
            {{ recurringPendingCount() }}
          </div>
          <div class="text-xs text-slate-500">Occurrences to confirm</div>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-slate-800">Occurrences</div>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Date</th>
              <th class="py-2">Name</th>
              <th class="py-2">Account</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of occurrences" class="border-t border-slate-100">
              <td class="py-3">{{ formatDate(item.date) }}</td>
              <td class="py-3">{{ resolveRecurringName(item) }}</td>
              <td class="py-3">{{ resolveAccountName(item) }}</td>
              <td class="py-3">{{ formatMoney(item.amount, item.currency) }}</td>
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
                  (click)="confirm(item)"
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
              <td colspan="6" class="py-4 text-center text-sm text-slate-500">No occurrences</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-slate-800">Recurring expense sources</div>
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
            <tr *ngFor="let item of recurringExpenses" class="border-t border-slate-100">
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
            <tr *ngIf="recurringExpenses.length === 0">
              <td colspan="7" class="py-4 text-center text-sm text-slate-500">No recurring expenses</td>
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
            {{ editing ? 'Edit recurring expense' : 'New recurring expense' }}
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
                placeholder="1,15"
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
  `,
})
export class RecurringExpensesComponent implements OnInit {
  recurringExpenses: RecurringExpenseItem[] = [];
  occurrences: RecurringExpenseOccurrence[] = [];
  accounts: AccountItem[] = [];
  categories: CategoryItem[] = [];
  isModalOpen = false;
  isSaving = false;
  isWorking = false;
  error = '';
  editing: RecurringExpenseItem | null = null;
  form: FormGroup;
  selectedMonth = new Date().toISOString().slice(0, 7);

  constructor(
    private readonly fb: FormBuilder,
    private readonly recurringExpensesApi: RecurringExpensesApiService,
    private readonly accountsApi: AccountsApiService,
    private readonly categoriesApi: CategoriesApiService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0)]],
      currency: ['USD', [Validators.required]],
      accountId: ['', [Validators.required]],
      categoryId: ['', [Validators.required]],
      daysOfMonth: ['1', [Validators.required]],
      notes: [''],
      isActive: [true],
    });
  }

  ngOnInit() {
    this.loadReferences();
    this.loadRecurring();
    this.loadMonth();
  }

  loadReferences() {
    this.accountsApi.list().subscribe({
      next: (items) => (this.accounts = items),
    });
    this.categoriesApi.list({ type: 'expense' }).subscribe({
      next: (items) => (this.categories = items),
    });
  }

  loadRecurring() {
    this.recurringExpensesApi.list().subscribe({
      next: (items) => (this.recurringExpenses = items),
    });
  }

  loadMonth() {
    this.recurringExpensesApi.occurrences(this.selectedMonth).subscribe({
      next: (items) => (this.occurrences = items),
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
      daysOfMonth: '1',
      notes: '',
      isActive: true,
    });
    this.isModalOpen = true;
  }

  openEdit(item: RecurringExpenseItem) {
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
      ? this.recurringExpensesApi.update(this.editing._id, payload)
      : this.recurringExpensesApi.create(payload);

    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.loadRecurring();
        this.loadMonth();
      },
      error: () => {
        this.error = 'Unable to save recurring expense';
        this.isSaving = false;
      },
    });
  }

  remove(item: RecurringExpenseItem) {
    this.recurringExpensesApi.remove(item._id).subscribe({
      next: () => {
        this.loadRecurring();
        this.loadMonth();
      },
    });
  }

  confirm(item: RecurringExpenseOccurrence) {
    if (item.status !== 'planned') {
      return;
    }
    this.isWorking = true;
    this.recurringExpensesApi.confirmOccurrence(item._id).subscribe({
      next: () => {
        this.isWorking = false;
        this.loadMonth();
      },
      error: () => {
        this.isWorking = false;
      },
    });
  }

  omit(item: RecurringExpenseOccurrence) {
    if (item.status !== 'planned') {
      return;
    }
    this.isWorking = true;
    this.recurringExpensesApi.omitOccurrence(item._id).subscribe({
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

  resolveAccountId(item: RecurringExpenseItem) {
    return typeof item.accountId === 'string' ? item.accountId : item.accountId?._id || '';
  }

  resolveCategoryId(item: RecurringExpenseItem) {
    return typeof item.categoryId === 'string' ? item.categoryId : item.categoryId?._id || '';
  }

  resolveAccountName(item: RecurringExpenseItem | RecurringExpenseOccurrence) {
    const account = item.accountId as { _id: string; name: string } | string;
    return typeof account === 'string' ? account : account?.name || '';
  }

  resolveCategoryName(item: RecurringExpenseItem) {
    const category = item.categoryId as { _id: string; name: string } | string;
    return typeof category === 'string' ? category : category?.name || '';
  }

  resolveRecurringName(item: RecurringExpenseOccurrence) {
    const recurring = item.recurringExpenseId as { _id: string; name: string } | string;
    return typeof recurring === 'string' ? recurring : recurring?.name || '';
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

  recurringPlannedTotal(currency: 'USD' | 'NIO') {
    return this.occurrences
      .filter((item) => item.currency === currency && item.status !== 'omitted')
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  }

  recurringConfirmedTotal(currency: 'USD' | 'NIO') {
    return this.occurrences
      .filter((item) => item.currency === currency && item.status === 'confirmed')
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  }

  recurringRemainingTotal(currency: 'USD' | 'NIO') {
    return this.occurrences
      .filter((item) => item.currency === currency && item.status === 'planned')
      .reduce((sum, item) => sum + (item.amount ?? 0), 0);
  }

  recurringPendingCount() {
    return this.occurrences.filter((item) => item.status === 'planned').length;
  }
}
