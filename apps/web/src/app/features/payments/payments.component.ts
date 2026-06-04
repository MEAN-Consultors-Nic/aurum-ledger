import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { PaymentsApiService } from '../../core/services/payments-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ClientsApiService } from '../../core/services/clients-api.service';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { ContractsApiService } from '../../core/services/contracts-api.service';
import { SettingsApiService } from '../../core/services/settings-api.service';
import { PaymentItem } from '../../core/models/payment.model';
import { ClientItem } from '../../core/models/client.model';
import { AccountItem } from '../../core/models/account.model';
import { ContractItem } from '../../core/models/contract.model';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-payments',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-2xl font-semibold">Payments</div>
          <div class="text-sm text-slate-500">Payment tracking and control</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          Record payment
        </button>
      </div>

      <div class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-5">
        <select
          [(ngModel)]="clientFilter"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All clients</option>
          <option *ngFor="let client of clients" [value]="client._id">
            {{ client.name }}
          </option>
        </select>
        <select
          [(ngModel)]="contractFilter"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All contracts</option>
          <option *ngFor="let contract of contracts" [value]="contract._id">
            {{ contract.title || contract._id }}
          </option>
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
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="load()"
        >
          Filter
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div *ngIf="isLoading" class="text-sm text-slate-500">Loading payments...</div>
        <div *ngIf="listError" class="text-sm text-red-600">{{ listError }}</div>

        <div class="grid gap-3 md:grid-cols-3">
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-400">Received</div>
            <div class="text-lg font-semibold">{{ formatMoney(totalReceivedUsd, 'USD') }}</div>
            <div class="text-xs text-slate-500">{{ formatMoney(totalReceivedNio, 'NIO') }}</div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-400">Retention</div>
            <div class="text-lg font-semibold">{{ formatMoney(totalRetentionUsd, 'USD') }}</div>
            <div class="text-xs text-slate-500">{{ formatMoney(totalRetentionNio, 'NIO') }}</div>
          </div>
          <div>
            <div class="text-xs uppercase tracking-wide text-slate-400">Applied</div>
            <div class="text-lg font-semibold">{{ formatMoney(totalAppliedUsd, 'USD') }}</div>
            <div class="text-xs text-slate-500">{{ formatMoney(totalAppliedNio, 'NIO') }}</div>
          </div>
        </div>

        <table *ngIf="!isLoading" class="mt-4 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Client</th>
              <th class="py-2">Contract</th>
              <th class="py-2">Date</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Retention</th>
              <th class="py-2">Currency</th>
              <th class="py-2">FX</th>
              <th class="py-2">Method</th>
              <th class="py-2">Reference</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of payments" class="border-t border-slate-100">
              <td class="py-3">{{ getClientName(item) }}</td>
              <td class="py-3">{{ getContractTitle(item) }}</td>
              <td class="py-3">{{ formatDate(item.paymentDate) }}</td>
              <td class="py-3">{{ formatMoney(item.amount, item.currency) }}</td>
              <td class="py-3">{{ formatMoney(item.retentionAmount || 0, item.currency) }}</td>
              <td class="py-3">{{ item.currency }}</td>
              <td class="py-3">{{ item.exchangeRate ? item.exchangeRate.toFixed(2) : '-' }}</td>
              <td class="py-3">{{ methodLabel(item.method) }}</td>
              <td class="py-3">{{ item.reference || '-' }}</td>
              <td class="py-3 text-right">
                <button class="text-xs text-slate-400" (click)="remove(item)">Delete</button>
              </td>
            </tr>
            <tr *ngIf="payments.length === 0 && !isLoading">
              <td colspan="10" class="py-6 text-center text-sm text-slate-500">
                No payments found
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
          <div class="text-lg font-semibold">Record payment</div>
          <button class="text-slate-400" (click)="closeModal()">X</button>
        </div>

        <form class="mt-4 space-y-6" [formGroup]="form" (ngSubmit)="save()">
          <div class="grid gap-4 md:grid-cols-3">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Client</label>
              <select
                formControlName="clientId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                (change)="onClientChange()"
              >
                <option value="">Select client</option>
                <option *ngFor="let client of clients" [value]="client._id">
                  {{ client.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Contract</label>
              <select
                formControlName="contractId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                (change)="onContractChange()"
              >
                <option value="">Select contract</option>
                <option *ngFor="let contract of filteredContracts" [value]="contract._id">
                  {{ contract.title || contract._id }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Method</label>
              <select
                formControlName="method"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                (change)="onMethodChange()"
              >
                <option value="cash">Cash</option>
                <option value="bank">Bank</option>
                <option value="paypal">PayPal</option>
              </select>
              <div *ngIf="!requiresAccount && !form.value.accountId" class="mt-1 text-xs text-rose-600">
                No account configured for this method.
              </div>
            </div>
          </div>

          <div *ngIf="requiresAccount || requiresReference" class="grid gap-4 md:grid-cols-2">
            <div *ngIf="requiresAccount">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Bank account</label>
              <select
                formControlName="accountId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select account</option>
                <option *ngFor="let account of filteredBankAccounts" [value]="account._id">
                  {{ account.name }} ({{ account.currency }})
                </option>
              </select>
              <div *ngIf="filteredBankAccounts.length === 0" class="mt-1 text-xs text-rose-600">
                No bank accounts available.
              </div>
            </div>
            <div *ngIf="requiresReference" [class.md:col-span-2]="!requiresAccount">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Reference</label>
              <input
                formControlName="reference"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Transfer reference"
              />
            </div>
          </div>

          <div *ngIf="selectedContract" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Contract summary</div>
            <div class="mt-2 grid gap-3 text-sm md:grid-cols-5">
              <div>
                <div class="text-xs uppercase tracking-wide text-slate-400">Amount</div>
                <div class="font-semibold text-slate-900">
                  {{ formatMoney(selectedContract.amount, selectedContract.currency) }}
                </div>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wide text-slate-400">Paid</div>
                <div class="font-semibold text-slate-900">
                  {{ formatMoney(selectedContract.paidTotal || 0, selectedContract.currency) }}
                </div>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wide text-slate-400">Balance</div>
                <div class="font-semibold text-slate-900">
                  {{ formatMoney(selectedContract.balance || 0, selectedContract.currency) }}
                </div>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wide text-slate-400">Due</div>
                <div class="font-semibold text-slate-900">
                  {{ formatDate(selectedContract.endDate) }}
                </div>
              </div>
              <div>
                <div class="text-xs uppercase tracking-wide text-slate-400">Period</div>
                <div class="font-semibold text-slate-900">
                  {{ selectedContract.billingPeriod === 'monthly' ? 'Monthly' :
                     selectedContract.billingPeriod === 'annual' ? 'Annual' : 'One-time' }}
                </div>
              </div>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Amount received</label>
              <input
                formControlName="amount"
                type="number"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Retention</label>
              <input
                formControlName="retentionAmount"
                type="number"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Exchange rate</label>
              <input
                formControlName="exchangeRate"
                type="number"
                step="0.01"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div class="mt-1 text-xs text-slate-500">1 USD = X NIO</div>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-3">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Currency</label>
              <select
                formControlName="currency"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                (change)="onCurrencyChange()"
              >
                <option *ngFor="let currency of currencies" [value]="currency">
                  {{ currency }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Payment date</label>
              <input
                formControlName="paymentDate"
                type="date"
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

          <div *ngIf="validationError" class="text-sm text-red-600">{{ validationError }}</div>
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
  `,
})
export class PaymentsComponent implements OnInit {
  payments: PaymentItem[] = [];
  clients: ClientItem[] = [];
  contracts: ContractItem[] = [];
  accounts: AccountItem[] = [];
  filteredContracts: ContractItem[] = [];
  selectedContract: ContractItem | null = null;
  isLoading = false;
  isSaving = false;
  isModalOpen = false;
  listError = '';
  modalError = '';
  validationError = '';
  totalReceivedUsd = 0;
  totalReceivedNio = 0;
  totalRetentionUsd = 0;
  totalRetentionNio = 0;
  totalAppliedUsd = 0;
  totalAppliedNio = 0;
  currencies: Array<'USD' | 'NIO'> = ['USD', 'NIO'];
  fxRate = environment.fxRateUsdToNio;

  clientFilter = '';
  contractFilter = '';
  from = '';
  to = '';

  form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly paymentsApi: PaymentsApiService,
    private readonly clientsApi: ClientsApiService,
    private readonly contractsApi: ContractsApiService,
    private readonly accountsApi: AccountsApiService,
    private readonly settingsApi: SettingsApiService,
    private readonly confirm: ConfirmService,
  ) {
    this.form = this.fb.group({
      clientId: ['', [Validators.required]],
      contractId: ['', [Validators.required]],
      accountId: [''],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      retentionAmount: [0, [Validators.min(0)]],
      currency: ['USD', [Validators.required]],
      exchangeRate: [this.fxRate, [Validators.required, Validators.min(0.0001)]],
      paymentDate: ['', [Validators.required]],
      method: ['cash', [Validators.required]],
      reference: [''],
      notes: [''],
    });
  }

  ngOnInit() {
    this.loadDependencies();
    this.load();
  }

  loadDependencies() {
    this.clientsApi.list({ isActive: true, limit: 200 }).subscribe({
      next: (response) => {
        this.clients = response.items;
      },
    });

    this.contractsApi.list({ limit: 200, onlyOpen: true }).subscribe({
      next: (response) => {
        this.contracts = response.items;
        this.filteredContracts = response.items;
      },
    });

    this.accountsApi.list({ isActive: true }).subscribe({
      next: (items) => {
        this.accounts = items;
      },
    });

    this.settingsApi.list().subscribe({
      next: (items) => {
        const fxSetting = items.find((item) => item.key === 'fxUsdToNio')?.value;
        const fx = Number(fxSetting);
        if (Number.isFinite(fx) && fx > 0) {
          this.fxRate = fx;
          this.form.patchValue({ exchangeRate: fx });
        }
      },
    });
  }

  load() {
    this.isLoading = true;
    this.listError = '';
    this.paymentsApi
      .list({
        clientId: this.clientFilter || undefined,
        contractId: this.contractFilter || undefined,
        from: this.from || undefined,
        to: this.to || undefined,
      })
      .subscribe({
        next: (response) => {
          this.payments = response.items;
          this.computeTotals();
          this.isLoading = false;
        },
        error: () => {
      this.listError = 'Unable to load list';
          this.isLoading = false;
        },
      });
  }

  openCreate() {
    this.validationError = '';
    this.modalError = '';
    this.form.reset({
      clientId: '',
      contractId: '',
      accountId: '',
      amount: 0,
      retentionAmount: 0,
      currency: 'USD',
      exchangeRate: this.fxRate,
      paymentDate: '',
      method: 'cash',
      reference: '',
      notes: '',
    });
    this.selectedContract = null;
    this.filteredContracts = this.contracts;
    this.onMethodChange();
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  onClientChange() {
    const clientId = this.form.value.clientId as string;
    if (!clientId) {
      this.filteredContracts = this.contracts;
      this.selectedContract = null;
      return;
    }
    this.filteredContracts = this.contracts.filter(
      (contract) => this.getClientIdFromContract(contract) === clientId,
    );
    if (this.filteredContracts.length === 0) {
      this.form.patchValue({ contractId: '' });
      this.selectedContract = null;
    }
  }

  onContractChange() {
    const contractId = this.form.value.contractId as string;
    const contract = this.contracts.find((item) => item._id === contractId);
    this.selectedContract = contract ?? null;
    if (!contract) {
      return;
    }
    const clientId = this.getClientIdFromContract(contract);
    if (clientId && this.form.value.clientId !== clientId) {
      this.form.patchValue({ clientId });
    }
  }

  onMethodChange() {
    const method = this.selectedMethod;
    const accountControl = this.form.get('accountId');
    const referenceControl = this.form.get('reference');
    if (this.requiresAccount) {
      accountControl?.setValidators([Validators.required]);
      const bankAccountIds = this.filteredBankAccounts.map((account) => account._id);
      if (!bankAccountIds.includes(this.form.value.accountId)) {
        this.form.patchValue({ accountId: '' });
      }
    } else {
      accountControl?.clearValidators();
      const defaultAccountId = this.findDefaultAccountId(method);
      this.form.patchValue({ accountId: defaultAccountId });
    }
    if (this.requiresReference) {
      referenceControl?.setValidators([Validators.required]);
    } else {
      referenceControl?.clearValidators();
      this.form.patchValue({ reference: '' });
    }
    accountControl?.updateValueAndValidity();
    referenceControl?.updateValueAndValidity();
  }

  onCurrencyChange() {
    if (!this.requiresAccount) {
      const defaultAccountId = this.findDefaultAccountId(this.selectedMethod);
      this.form.patchValue({ accountId: defaultAccountId });
    }
  }

  async save() {
    if (this.form.invalid) {
      return;
    }
    if (this.form.dirty) {
      const confirmed = await this.confirm.open({
        title: 'Confirm payment',
        message: 'Record this payment with the current details?',
        confirmText: 'Record payment',
      });
      if (!confirmed) {
        return;
      }
    }

    this.isSaving = true;
    this.validationError = '';
    this.modalError = '';

    const currency = (this.form.value.currency || 'USD') as 'USD' | 'NIO';
    const exchangeRate = Number(this.form.value.exchangeRate || this.fxRate);
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      this.isSaving = false;
      this.validationError = 'Invalid exchange rate';
      return;
    }

    const payload = {
      clientId: this.form.value.clientId ?? '',
      contractId: this.form.value.contractId ?? '',
      accountId: this.form.value.accountId ?? '',
      amount: Number(this.form.value.amount ?? 0),
      retentionAmount: Number(this.form.value.retentionAmount ?? 0),
      currency,
      exchangeRate,
      paymentDate: this.form.value.paymentDate ?? '',
      method: (this.form.value.method || 'cash') as 'cash' | 'bank' | 'paypal',
      reference: this.requiresReference ? this.form.value.reference || undefined : undefined,
      notes: this.form.value.notes || undefined,
    };

    console.info('Payments save payload', payload);
    this.paymentsApi.create(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.load();
      },
      error: (err) => {
        console.error('Payments save error', err);
        this.isSaving = false;
        this.modalError = this.getErrorMessage(err) ?? 'Unable to save payment';
      },
    });
  }

  async remove(item: PaymentItem) {
    const confirmed = await this.confirm.open({
      title: 'Confirm delete',
      message: 'Delete this payment? This cannot be undone.',
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.paymentsApi.remove(item._id).subscribe({
      next: () => this.load(),
      error: () => {
        this.listError = 'Unable to delete payment';
      },
    });
  }

  getClientName(item: PaymentItem) {
    if (typeof item.clientId === 'string') {
      return this.clients.find((client) => client._id === item.clientId)?.name ?? item.clientId;
    }
    return item.clientId?.name ?? '-';
  }

  getContractTitle(item: PaymentItem) {
    if (typeof item.contractId === 'string') {
      return this.contracts.find((contract) => contract._id === item.contractId)?.title ?? item.contractId;
    }
    return item.contractId?.title ?? '-';
  }

  getClientIdFromContract(contract: ContractItem) {
    return typeof contract.clientId === 'string' ? contract.clientId : contract.clientId?._id ?? '';
  }

  methodLabel(method: PaymentItem['method']) {
    if (method === 'cash') {
      return 'Cash';
    }
    if (method === 'bank') {
      return 'Bank';
    }
    if (method === 'paypal') {
      return 'PayPal';
    }
    if (method === 'card') {
      return 'Card';
    }
    if (method === 'transfer') {
      return 'Transfer';
    }
    return 'Other';
  }

  formatDate(date?: string) {
    if (!date) {
      return '-';
    }
    return new Date(date).toLocaleDateString('en-US');
  }

  formatMoney(amount: number, currency: 'USD' | 'NIO' = 'USD') {
    const value = Number(amount ?? 0).toFixed(2);
    return `${currency} ${value}`;
  }

  get selectedMethod() {
    return (this.form.value.method || 'cash') as 'cash' | 'bank' | 'paypal';
  }

  get requiresAccount() {
    return this.selectedMethod === 'bank';
  }

  get requiresReference() {
    return this.selectedMethod === 'bank' || this.selectedMethod === 'paypal';
  }

  get filteredBankAccounts() {
    return this.accounts.filter((account) => account.type === 'bank');
  }

  private findDefaultAccountId(method: 'cash' | 'bank' | 'paypal') {
    const currency = (this.form.value.currency || 'USD') as 'USD' | 'NIO';
    const type = method === 'paypal' ? 'paypal' : 'cash';
    const byTypeCurrency = this.accounts.filter(
      (account) => account.type === type && account.currency === currency,
    );
    if (byTypeCurrency.length > 0) {
      return byTypeCurrency[0]._id;
    }
    const byType = this.accounts.filter((account) => account.type === type);
    return byType[0]?._id ?? '';
  }

  private computeTotals() {
    this.totalReceivedUsd = 0;
    this.totalReceivedNio = 0;
    this.totalRetentionUsd = 0;
    this.totalRetentionNio = 0;
    this.totalAppliedUsd = 0;
    this.totalAppliedNio = 0;

    this.payments.forEach((item) => {
      const rate = item.exchangeRate || this.fxRate;
      const received = Number(item.amount || 0);
      const retention = Number(item.retentionAmount || 0);
      const applied = received + retention;

      if (item.currency === 'USD') {
        this.totalReceivedUsd += received;
        this.totalRetentionUsd += retention;
        this.totalAppliedUsd += applied;
        this.totalReceivedNio += received * rate;
        this.totalRetentionNio += retention * rate;
        this.totalAppliedNio += applied * rate;
      } else {
        this.totalReceivedNio += received;
        this.totalRetentionNio += retention;
        this.totalAppliedNio += applied;
        this.totalReceivedUsd += received / rate;
        this.totalRetentionUsd += retention / rate;
        this.totalAppliedUsd += applied / rate;
      }
    });
  }

  private getErrorMessage(error: unknown) {
    const payload = (error as { error?: { message?: string | string[] } })?.error;
    if (!payload?.message) {
      return null;
    }
    if (Array.isArray(payload.message)) {
      return payload.message.join(', ');
    }
    return payload.message;
  }
}
