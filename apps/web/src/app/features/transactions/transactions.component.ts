import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { TransactionsApiService } from '../../core/services/transactions-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { AccountItem } from '../../core/models/account.model';
import { CategoryItem } from '../../core/models/category.model';
import { TransactionItem } from '../../core/models/transaction.model';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-2xl font-semibold">Transactions---</div>
          <div class="text-sm text-slate-500">Record income, expenses, and adjustments</div>
        </div>
        <div class="flex gap-2">
          <button
            class="rounded border border-slate-200 px-3 py-2 text-xs uppercase tracking-wide text-slate-700"
            (click)="openTransfer()"
          >
            Transfer
          </button>
          <button
            class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
            (click)="openCreate()"
          >
            New transaction
          </button>
        </div>
      </div>

      <div class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-6">
        <select [(ngModel)]="accountFilter" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">All accounts</option>
          <option *ngFor="let account of accounts" [value]="account._id">
            {{ account.name }}
          </option>
        </select>
        <select [(ngModel)]="typeFilter" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="adjustment">Adjustment</option>
          <option value="transfer">Transfer</option>
        </select>
        <input
          type="date"
          [(ngModel)]="from"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <input
          type="date"
          [(ngModel)]="to"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select [(ngModel)]="sortField" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="date">Sort by date</option>
          <option value="amount">Sort by amount</option>
          <option value="accountId">Sort by account</option>
          <option value="type">Sort by type</option>
          <option value="categoryId">Sort by category</option>
          <option value="notes">Sort by notes</option>
        </select>
        <select [(ngModel)]="sortDirection" class="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="desc">Newest / highest</option>
          <option value="asc">Oldest / lowest</option>
        </select>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white lg:col-span-6"
          (click)="load()"
        >
          Filter
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div *ngIf="isLoading" class="text-sm text-slate-500">Loading transactions...</div>
        <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

        <table *ngIf="!isLoading" class="mt-2 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Date</th>
              <th class="py-2">Account</th>
              <th class="py-2">Type</th>
              <th class="py-2">Category</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Notes</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of transactions" class="border-t border-slate-100">
              <td class="py-3">{{ formatDate(item.date) }}</td>
              <td class="py-3">{{ resolveAccountName(item.accountId) }}</td>
              <td class="py-3">{{ formatType(item) }}</td>
              <td class="py-3">{{ resolveCategoryName(item.categoryId) }}</td>
              <td class="py-3">{{ formatMoney(item.amount, item.currency) }}</td>
              <td class="py-3">{{ item.notes || '-' }}</td>
              <td class="py-3 text-right">
                <button
                  class="rounded border border-red-200 px-2 py-1 text-xs uppercase tracking-wide text-red-600"
                  [disabled]="voidingIds.has(item._id)"
                  (click)="voidTransaction(item)"
                >
                  {{ voidingIds.has(item._id) ? 'Voiding...' : 'Anular' }}
                </button>
              </td>
            </tr>
            <tr *ngIf="transactions.length === 0 && !isLoading">
              <td colspan="7" class="py-6 text-center text-sm text-slate-500">
                No transactions found
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      *ngIf="isModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">New transaction</div>
          <button class="text-slate-400" (click)="closeModal()">X</button>
        </div>

        <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="save()">
          <div class="grid gap-4 md:grid-cols-3">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Type</label>
              <select
                formControlName="type"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                (change)="onTypeChange()"
              >
                <option value="income">Income</option>
                <option value="expense">Expense</option>
                <option value="adjustment">Adjustment</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Account</label>
              <select
                formControlName="accountId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                (change)="onAccountChange()"
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
                [disabled]="form.value.type === 'adjustment'"
              >
                <option value="">Select category</option>
                <option *ngFor="let category of filteredCategories" [value]="category._id">
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
              <input
                formControlName="currency"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                readonly
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Date</label>
              <input
                formControlName="date"
                type="date"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div *ngIf="form.value.type === 'adjustment'">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Direction</label>
              <select
                formControlName="flow"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="in">Increase balance</option>
                <option value="out">Decrease balance</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Reference</label>
              <input
                formControlName="reference"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Notes</label>
            <textarea
              formControlName="notes"
              rows="2"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            ></textarea>
          </div>

          <div *ngIf="modalError" class="text-sm text-red-600">{{ modalError }}</div>

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
      *ngIf="isTransferOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">Transfer between accounts</div>
          <button class="text-slate-400" (click)="closeTransfer()">X</button>
        </div>

        <form class="mt-4 space-y-4" [formGroup]="transferForm" (ngSubmit)="saveTransfer()">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">From account</label>
              <select
                formControlName="fromAccountId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                (change)="onTransferAccountChange()"
              >
                <option value="">Select account</option>
                <option *ngFor="let account of accounts" [value]="account._id">
                  {{ account.name }} ({{ account.currency }})
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">To account</label>
              <select
                formControlName="toAccountId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select account</option>
                <option *ngFor="let account of accounts" [value]="account._id">
                  {{ account.name }} ({{ account.currency }})
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
              <input
                formControlName="currency"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                readonly
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Date</label>
              <input
                formControlName="date"
                type="date"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Exchange rate</label>
            <input
              formControlName="exchangeRate"
              type="number"
              step="0.01"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div class="mt-1 text-xs text-slate-500">Use the exchange rate if accounts have different currencies.</div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Reference</label>
              <input
                formControlName="reference"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Notes</label>
              <input
                formControlName="notes"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div *ngIf="transferError" class="text-sm text-red-600">{{ transferError }}</div>

          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm text-slate-500" (click)="closeTransfer()">
              Cancel
            </button>
            <button
              type="submit"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white"
              [disabled]="transferForm.invalid || isSavingTransfer"
            >
              {{ isSavingTransfer ? 'Saving...' : 'Transfer' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class TransactionsComponent implements OnInit {
  transactions: TransactionItem[] = [];
  accounts: AccountItem[] = [];
  categories: CategoryItem[] = [];
  filteredCategories: CategoryItem[] = [];

  isLoading = false;
  isSaving = false;
  isSavingTransfer = false;
  isModalOpen = false;
  isTransferOpen = false;
  error = '';
  modalError = '';
  transferError = '';
  voidingIds = new Set<string>();

  accountFilter = '';
  typeFilter = '';
  from = '';
  to = '';
  sortField: 'date' | 'amount' | 'accountId' | 'type' | 'categoryId' | 'notes' = 'date';
  sortDirection: 'asc' | 'desc' = 'desc';

  form: FormGroup;
  transferForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly accountsApi: AccountsApiService,
    private readonly categoriesApi: CategoriesApiService,
    private readonly transactionsApi: TransactionsApiService,
    private readonly confirm: ConfirmService,
  ) {
    this.form = this.fb.group({
      type: ['expense', [Validators.required]],
      accountId: ['', [Validators.required]],
      categoryId: [''],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      currency: ['USD', [Validators.required]],
      date: ['', [Validators.required]],
      flow: ['in'],
      reference: [''],
      notes: [''],
    });

    this.transferForm = this.fb.group({
      fromAccountId: ['', [Validators.required]],
      toAccountId: ['', [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      currency: ['USD', [Validators.required]],
      date: ['', [Validators.required]],
      exchangeRate: [36],
      reference: [''],
      notes: [''],
    });
  }

  ngOnInit() {
    this.loadDependencies();
    this.load();
  }

  loadDependencies() {
    this.accountsApi.list({ isActive: true }).subscribe({
      next: (items) => (this.accounts = items),
    });
    this.categoriesApi.list().subscribe({
      next: (items) => {
        this.categories = items;
        this.applyCategoryFilter();
      },
    });
  }

  load() {
    this.isLoading = true;
    this.error = '';
    this.transactionsApi
      .list({
        accountId: this.accountFilter || undefined,
        type: this.typeFilter || undefined,
        from: this.from || undefined,
        to: this.to || undefined,
        sortField: this.sortField,
        sortDirection: this.sortDirection,
      })
      .subscribe({
        next: (items) => {
          this.transactions = items;
          this.isLoading = false;
        },
        error: () => {
        this.error = 'Unable to load transactions';
          this.isLoading = false;
        },
      });
  }

  openCreate() {
    this.modalError = '';
    this.form.reset({
      type: 'expense',
      accountId: '',
      categoryId: '',
      amount: 0,
      currency: 'USD',
      date: '',
      flow: 'in',
      reference: '',
      notes: '',
    });
    this.applyCategoryFilter();
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }


  
  openTransfer() {
    this.transferError = '';
    this.transferForm.reset({
      fromAccountId: '',
      toAccountId: '',
      amount: 0,
      currency: 'USD',
      date: '',
      exchangeRate: 36,
      reference: '',
      notes: '',
    });
    this.isTransferOpen = true;
  }

  closeTransfer() {
    this.isTransferOpen = false;
  }

  onTypeChange() {
    this.applyCategoryFilter();
  }

  onAccountChange() {
    const account = this.accounts.find((item) => item._id === this.form.value.accountId);
    if (account) {
      this.form.patchValue({ currency: account.currency });
    }
  }

  onTransferAccountChange() {
    const account = this.accounts.find((item) => item._id === this.transferForm.value.fromAccountId);
    if (account) {
      this.transferForm.patchValue({ currency: account.currency });
    }
  }

  async save() {
    if (this.form.invalid) {
      return;
    }
    if (this.form.dirty) {
      const confirmed = await this.confirm.open({
        title: 'Confirm transaction',
        message: 'Save this transaction with the current details?',
        confirmText: 'Save transaction',
      });
      if (!confirmed) {
        return;
      }
    }
    this.isSaving = true;
    const payload = {
      type: this.form.value.type,
      accountId: this.form.value.accountId,
      categoryId: this.form.value.categoryId || undefined,
      amount: Number(this.form.value.amount ?? 0),
      currency: this.form.value.currency ?? 'USD',
      date: this.form.value.date ?? '',
      flow: this.form.value.type === 'adjustment' ? this.form.value.flow : undefined,
      reference: this.form.value.reference || undefined,
      notes: this.form.value.notes || undefined,
    } as const;

    this.transactionsApi.create(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.load();
      },
      error: () => {
        this.isSaving = false;
        this.modalError = 'Unable to save transaction';
      },
    });
  }

  async saveTransfer() {
    if (this.transferForm.invalid) {
      return;
    }
    if (this.transferForm.dirty) {
      const confirmed = await this.confirm.open({
        title: 'Confirm transfer',
        message: 'Transfer between these accounts with the current details?',
        confirmText: 'Transfer',
      });
      if (!confirmed) {
        return;
      }
    }
    this.isSavingTransfer = true;
    const payload = {
      fromAccountId: this.transferForm.value.fromAccountId ?? '',
      toAccountId: this.transferForm.value.toAccountId ?? '',
      amount: Number(this.transferForm.value.amount ?? 0),
      currency: this.transferForm.value.currency ?? 'USD',
      exchangeRate: Number(this.transferForm.value.exchangeRate ?? 0),
      date: this.transferForm.value.date ?? '',
      reference: this.transferForm.value.reference || undefined,
      notes: this.transferForm.value.notes || undefined,
    };

    this.transactionsApi.transfer(payload).subscribe({
      next: () => {
        this.isSavingTransfer = false;
        this.isTransferOpen = false;
        this.load();
      },
      error: () => {
        this.isSavingTransfer = false;
        this.transferError = 'Unable to save transfer';
      },
    });
  }

  applyCategoryFilter() {
    const type = this.form.value.type ?? 'expense';
    if (type === 'adjustment') {
      this.filteredCategories = [];
      return;
    }
    this.filteredCategories = this.categories.filter((item) => item.type === type);
  }

  resolveAccountName(account: TransactionItem['accountId']) {
    if (typeof account === 'string') {
      return this.accounts.find((item) => item._id === account)?.name ?? account;
    }
    return account?.name ?? '-';
  }

  resolveCategoryName(category?: TransactionItem['categoryId']) {
    if (!category) {
      return '-';
    }
    if (typeof category === 'string') {
      return this.categories.find((item) => item._id === category)?.name ?? category;
    }
    return category?.name ?? '-';
  }

  formatDate(date?: string) {
    if (!date) {
      return '-';
    }
    return new Date(date).toLocaleDateString('en-US');
  }

  formatMoney(amount: number, currency: 'USD' | 'NIO') {
    return `${currency} ${Number(amount ?? 0).toFixed(2)}`;
  }

  formatType(item: TransactionItem) {
    if (item.type === 'income') {
      return 'Income';
    }
    if (item.type === 'expense') {
      return 'Expense';
    }
    if (item.type === 'adjustment') {
      return item.flow === 'in' ? 'Adjustment +' : 'Adjustment -';
    }
    return 'Transfer';
  }

  async voidTransaction(item: TransactionItem) {
    const confirmed = await this.confirm.open({
      title: 'Confirm void',
      message: 'Void this transaction and recalculate balances?',
      confirmText: 'Void transaction',
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    this.voidingIds.add(item._id);
    this.transactionsApi.void(item._id).subscribe({
      next: () => {
        this.voidingIds.delete(item._id);
        this.load();
      },
      error: () => {
        this.voidingIds.delete(item._id);
        this.error = 'Unable to void transaction';
      },
    });
  }
}
