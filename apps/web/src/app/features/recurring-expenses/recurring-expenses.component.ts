import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { RecurringExpensesApiService } from '../../core/services/recurring-expenses-api.service';
import {
  RecurringExpenseItem,
  RecurringExpenseOccurrence,
} from '../../core/models/recurring-expense.model';
import { AccountItem } from '../../core/models/account.model';
import { CategoryItem } from '../../core/models/category.model';
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';

@Component({
  selector: 'app-recurring-expenses',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ActionMenuComponent],
  template: `
    <div class="space-y-6">
      <!-- HERO -->
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-slate-900">Recurring expenses</div>
          <div class="mt-1 text-sm text-slate-500">
            Subscriptions, utilities, retainers — track monthly outflows and confirm what was actually paid.
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
            + Add expense
          </button>
        </div>
      </header>

      <!-- ALERT BANNER -->
      <div
        *ngIf="overdueCount() > 0"
        class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"
      >
        <div class="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">!</div>
        <div class="flex-1">
          <div class="text-sm font-semibold text-rose-900">
            {{ overdueCount() }} expense{{ overdueCount() === 1 ? '' : 's' }} overdue
          </div>
          <div class="text-xs text-rose-800">
            Confirm what you paid, or omit if it won't go through. Keeps your cashflow accurate.
          </div>
        </div>
      </div>

      <!-- MONTH OVERVIEW -->
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {{ monthLabel() }} · {{ recurringExpenses.length }} {{ recurringExpenses.length === 1 ? 'expense' : 'expenses' }}
            </div>
            <div class="mt-2 text-3xl font-semibold text-slate-900">
              {{ formatMoney(recurringPlannedTotal('USD'), 'USD') }}
            </div>
            <div class="text-sm text-slate-500">
              + {{ formatMoney(recurringPlannedTotal('NIO'), 'NIO') }} expected to pay
            </div>
          </div>
          <div class="md:text-right">
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Confirmed so far</div>
            <div class="mt-2 text-3xl font-semibold text-rose-700">
              {{ formatMoney(recurringConfirmedTotal('USD'), 'USD') }}
            </div>
            <div class="text-sm text-slate-500">
              + {{ formatMoney(recurringConfirmedTotal('NIO'), 'NIO') }} paid
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
              class="h-full bg-rose-500 transition-all"
              [style.width.%]="confirmationProgress().percent"
            ></div>
          </div>
        </div>

        <!-- Remaining hint -->
        <div class="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
          <div>
            Remaining USD: <span class="font-semibold text-slate-900">{{ formatMoney(recurringRemainingTotal('USD'), 'USD') }}</span>
          </div>
          <div class="md:text-right">
            Remaining NIO: <span class="font-semibold text-slate-900">{{ formatMoney(recurringRemainingTotal('NIO'), 'NIO') }}</span>
          </div>
        </div>
      </section>

      <!-- SCHEDULE -->
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-5 py-4">
          <div class="text-sm font-semibold text-slate-900">Schedule</div>
          <div class="text-xs text-slate-500">
            Confirm what was paid, omit if the charge won't happen.
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
                  <span class="font-medium text-slate-900">{{ resolveRecurringName(o) }}</span>
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
                  (click)="confirm(o)"
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
                <div class="font-medium text-slate-900">{{ resolveRecurringName(o) }}</div>
                <div class="text-xs text-slate-500">
                  Due {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}
                </div>
              </div>
              <div class="font-semibold text-slate-900">{{ formatMoney(o.amount, o.currency) }}</div>
              <div class="flex items-center gap-2">
                <button
                  (click)="confirm(o)"
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
                <div class="font-medium text-slate-900">{{ resolveRecurringName(o) }}</div>
                <div class="text-xs text-slate-500">
                  Due {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}
                </div>
              </div>
              <div class="font-semibold text-slate-900">{{ formatMoney(o.amount, o.currency) }}</div>
              <div class="flex items-center gap-2">
                <button
                  (click)="confirm(o)"
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
            <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Paid</span>
            <span class="text-xs text-slate-500">{{ grouped().confirmed.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().confirmed" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <span class="text-emerald-600">✓</span>
                <div class="min-w-0">
                  <div class="font-medium text-slate-900">{{ resolveRecurringName(o) }}</div>
                  <div class="text-xs text-slate-500">
                    Paid {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}
                  </div>
                </div>
              </div>
              <div class="font-semibold text-emerald-700">{{ formatMoney(o.amount, o.currency) }}</div>
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
                <div class="line-through">{{ resolveRecurringName(o) }}</div>
                <div class="text-xs">{{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}</div>
              </div>
              <div class="text-slate-400 line-through">{{ formatMoney(o.amount, o.currency) }}</div>
              <button
                (click)="reactivate(o)"
                [disabled]="isWorking"
                class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Reactivate
              </button>
            </li>
          </ul>
        </ng-container>

        <div *ngIf="occurrences.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
          No recurring charges for this month. Add a recurring expense below.
        </div>
      </section>

      <!-- BY CATEGORY -->
      <section *ngIf="byCategory().length > 0" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div class="text-sm font-semibold text-slate-900">By category</div>
        <div class="mt-4 space-y-4">
          <div *ngFor="let row of byCategory()">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-slate-900">{{ row.name }}</span>
              <span class="text-slate-600">
                <span class="font-semibold text-emerald-700">{{ formatMoney(row.paid, row.currency) }}</span>
                <span class="text-slate-400"> / {{ formatMoney(row.planned, row.currency) }}</span>
              </span>
            </div>
            <div class="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div class="h-full bg-emerald-500 transition-all" [style.width.%]="row.percent"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- RECURRING SOURCES -->
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div class="text-sm font-semibold text-slate-900">Recurring expense sources</div>
            <div class="text-xs text-slate-500">
              Templates that generate the monthly occurrences above.
            </div>
          </div>
          <button
            (click)="openCreate()"
            class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
          >
            + Add expense
          </button>
        </div>

        <div *ngIf="recurringExpenses.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
          No recurring expenses yet. Add one to start tracking monthly outflows.
        </div>

        <ul *ngIf="recurringExpenses.length > 0" class="divide-y divide-slate-100">
          <li *ngFor="let s of recurringExpenses" class="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
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
    private readonly confirmDialog: ConfirmService,
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

  sourceActions(item: RecurringExpenseItem): ActionMenuItem[] {
    return [
      { label: 'Edit', action: () => this.openEdit(item) },
      { label: item.isActive ? 'Disable' : 'Enable', action: () => this.toggleActive(item) },
      { label: 'Delete', action: () => this.remove(item), danger: true },
    ];
  }

  occurrenceActions(item: RecurringExpenseOccurrence): ActionMenuItem[] {
    const locked = item.status !== 'planned' || this.isWorking;
    return [
      { label: 'Confirm payment', action: () => this.confirm(item), disabled: locked },
      { label: 'Omit', action: () => this.omit(item), disabled: locked, danger: true },
    ];
  }

  toggleActive(item: RecurringExpenseItem) {
    this.recurringExpensesApi.update(item._id, { isActive: !item.isActive }).subscribe({
      next: () => this.loadRecurring(),
    });
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

  async remove(item: RecurringExpenseItem) {
    const confirmed = await this.confirmDialog.open({
      title: 'Delete recurring expense',
      message: `Delete "${item.name}"? Future planned occurrences will be removed. Confirmed occurrences stay intact. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
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

  reactivate(item: RecurringExpenseOccurrence) {
    if (item.status !== 'omitted') {
      return;
    }
    this.isWorking = true;
    this.recurringExpensesApi.reactivateOccurrence(item._id).subscribe({
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

  // ----- helpers for revamped UI -----
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

  overdueCount(): number {
    const now = Date.now();
    return this.occurrences.filter(
      (o) => o.status === 'planned' && new Date(o.date).getTime() < now,
    ).length;
  }

  grouped() {
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    const groups = {
      overdue: [] as RecurringExpenseOccurrence[],
      thisWeek: [] as RecurringExpenseOccurrence[],
      later: [] as RecurringExpenseOccurrence[],
      confirmed: [] as RecurringExpenseOccurrence[],
      omitted: [] as RecurringExpenseOccurrence[],
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
    const byDate = (a: RecurringExpenseOccurrence, b: RecurringExpenseOccurrence) =>
      a.date.localeCompare(b.date);
    groups.overdue.sort(byDate);
    groups.thisWeek.sort(byDate);
    groups.later.sort(byDate);
    groups.confirmed.sort(byDate);
    groups.omitted.sort(byDate);
    return groups;
  }

  byCategory() {
    const map = new Map<string, { name: string; currency: 'USD' | 'NIO'; planned: number; paid: number }>();
    for (const o of this.occurrences) {
      if (o.status === 'omitted') continue;
      const cat = o.categoryId;
      const catName = typeof cat === 'object' && cat ? cat.name : 'Uncategorized';
      const key = `${catName}::${o.currency}`;
      const entry = map.get(key) ?? { name: catName, currency: o.currency, planned: 0, paid: 0 };
      entry.planned += o.amount ?? 0;
      if (o.status === 'confirmed') entry.paid += o.amount ?? 0;
      map.set(key, entry);
    }
    return Array.from(map.values())
      .map((r) => ({
        ...r,
        percent: r.planned === 0 ? 0 : Math.min(100, Math.round((r.paid / r.planned) * 100)),
      }))
      .sort((a, b) => b.planned - a.planned);
  }

  formatShortDate(date?: string) {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
