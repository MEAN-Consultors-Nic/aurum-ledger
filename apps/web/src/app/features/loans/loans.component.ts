import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { LoansApiService } from '../../core/services/loans-api.service';
import { LoanItem, LoanPaymentOccurrence } from '../../core/models/loan.model';
import { AccountItem } from '../../core/models/account.model';
import { CategoryItem } from '../../core/models/category.model';

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="text-2xl font-semibold">Loans</div>
          <div class="text-sm text-slate-500">Track debts and scheduled payments</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          New loan
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

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-slate-800">Payment schedule</div>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Date</th>
              <th class="py-2">Loan</th>
              <th class="py-2">Account</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of occurrences" class="border-t border-slate-100">
              <td class="py-3">{{ formatDate(item.date) }}</td>
              <td class="py-3">{{ resolveLoanName(item) }}</td>
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
              <td colspan="6" class="py-4 text-center text-sm text-slate-500">No scheduled payments</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-slate-800">Loans</div>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Name</th>
              <th class="py-2">Principal</th>
              <th class="py-2">Installment</th>
              <th class="py-2">Account</th>
              <th class="py-2">Days</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of loans" class="border-t border-slate-100">
              <td class="py-3">{{ item.name }}</td>
              <td class="py-3">{{ formatMoney(item.principal, item.currency) }}</td>
              <td class="py-3">{{ formatMoney(item.installmentAmount, item.currency) }}</td>
              <td class="py-3">{{ resolveAccountName(item) }}</td>
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
            <tr *ngIf="loans.length === 0">
              <td colspan="7" class="py-4 text-center text-sm text-slate-500">No loans</td>
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
          <div class="text-lg font-semibold">{{ editing ? 'Edit loan' : 'New loan' }}</div>
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
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Principal</label>
              <input
                formControlName="principal"
                type="number"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Installment</label>
              <input
                formControlName="installmentAmount"
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
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Days</label>
            <input
              formControlName="daysOfMonth"
              placeholder="15,30"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
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
            <button type="button" class="text-sm text-slate-500" (click)="closeModal()">Cancel</button>
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
export class LoansComponent implements OnInit {
  loans: LoanItem[] = [];
  occurrences: LoanPaymentOccurrence[] = [];
  accounts: AccountItem[] = [];
  categories: CategoryItem[] = [];
  isModalOpen = false;
  isSaving = false;
  isWorking = false;
  error = '';
  editing: LoanItem | null = null;
  form: FormGroup;
  selectedMonth = new Date().toISOString().slice(0, 7);

  constructor(
    private readonly fb: FormBuilder,
    private readonly loansApi: LoansApiService,
    private readonly accountsApi: AccountsApiService,
    private readonly categoriesApi: CategoriesApiService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      principal: [0, [Validators.required, Validators.min(0)]],
      installmentAmount: [0, [Validators.required, Validators.min(0)]],
      currency: ['USD', [Validators.required]],
      accountId: ['', [Validators.required]],
      categoryId: ['', [Validators.required]],
      daysOfMonth: ['15,30', [Validators.required]],
      notes: [''],
      isActive: [true],
    });
  }

  ngOnInit() {
    this.loadReferences();
    this.loadLoans();
    this.loadMonth();
  }

  loadReferences() {
    this.accountsApi.list().subscribe({ next: (items) => (this.accounts = items) });
    this.categoriesApi.list({ type: 'expense' }).subscribe({ next: (items) => (this.categories = items) });
  }

  loadLoans() {
    this.loansApi.list().subscribe({ next: (items) => (this.loans = items) });
  }

  loadMonth() {
    this.loansApi.occurrences(this.selectedMonth).subscribe({ next: (items) => (this.occurrences = items) });
  }

  openCreate() {
    this.editing = null;
    this.form.reset({
      name: '',
      principal: 0,
      installmentAmount: 0,
      currency: 'USD',
      accountId: '',
      categoryId: '',
      daysOfMonth: '15,30',
      notes: '',
      isActive: true,
    });
    this.isModalOpen = true;
  }

  openEdit(item: LoanItem) {
    this.editing = item;
    this.form.reset({
      name: item.name,
      principal: item.principal,
      installmentAmount: item.installmentAmount,
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
      principal: Number(this.form.value.principal || 0),
      installmentAmount: Number(this.form.value.installmentAmount || 0),
      currency: (this.form.value.currency || 'USD') as 'USD' | 'NIO',
      accountId: String(this.form.value.accountId || ''),
      categoryId: String(this.form.value.categoryId || ''),
      daysOfMonth: days,
      notes: String(this.form.value.notes || ''),
      isActive: Boolean(this.form.value.isActive),
    };

    const request = this.editing
      ? this.loansApi.update(this.editing._id, payload)
      : this.loansApi.create(payload);

    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.loadLoans();
        this.loadMonth();
      },
      error: () => {
        this.error = 'Unable to save loan';
        this.isSaving = false;
      },
    });
  }

  remove(item: LoanItem) {
    this.loansApi.remove(item._id).subscribe({
      next: () => {
        this.loadLoans();
        this.loadMonth();
      },
    });
  }

  confirm(item: LoanPaymentOccurrence) {
    if (item.status !== 'planned') {
      return;
    }
    this.isWorking = true;
    this.loansApi.confirmOccurrence(item._id).subscribe({
      next: () => {
        this.isWorking = false;
        this.loadMonth();
      },
      error: () => {
        this.isWorking = false;
      },
    });
  }

  omit(item: LoanPaymentOccurrence) {
    if (item.status !== 'planned') {
      return;
    }
    this.isWorking = true;
    this.loansApi.omitOccurrence(item._id).subscribe({
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

  resolveAccountId(item: LoanItem) {
    return typeof item.accountId === 'string' ? item.accountId : item.accountId?._id || '';
  }

  resolveCategoryId(item: LoanItem) {
    return typeof item.categoryId === 'string' ? item.categoryId : item.categoryId?._id || '';
  }

  resolveAccountName(item: LoanItem | LoanPaymentOccurrence) {
    const account = item.accountId as { _id: string; name: string } | string;
    return typeof account === 'string' ? account : account?.name || '';
  }

  resolveLoanName(item: LoanPaymentOccurrence) {
    const loan = item.loanId as { _id: string; name: string } | string;
    return typeof loan === 'string' ? loan : loan?.name || '';
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
}
