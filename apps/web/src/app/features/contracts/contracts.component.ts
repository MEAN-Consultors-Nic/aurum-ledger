import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ContractsApiService } from '../../core/services/contracts-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ClientsApiService } from '../../core/services/clients-api.service';
import { ServicesApiService } from '../../core/services/services-api.service';
import { ContractItem } from '../../core/models/contract.model';
import { ClientItem } from '../../core/models/client.model';
import { ServiceItem } from '../../core/models/service.model';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-2xl font-semibold">Contracts</div>
          <div class="text-sm text-slate-500">Contract management and due dates</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          New contract
        </button>
      </div>

      <div class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-6">
        <input
          type="text"
          [(ngModel)]="search"
          (keyup.enter)="load()"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Search by title"
        />
        <select
          [(ngModel)]="statusFilter"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          [(ngModel)]="clientFilter"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All clients</option>
          <option *ngFor="let client of clients" [value]="client._id">
            {{ client.name }}
          </option>
        </select>
        <div class="flex gap-2 lg:col-span-2">
          <input
            type="date"
            [(ngModel)]="dueFrom"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            type="date"
            [(ngModel)]="dueTo"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="load()"
        >
          Filter
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div *ngIf="isLoading" class="text-sm text-slate-500">Loading contracts...</div>
        <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

        <table *ngIf="!isLoading" class="mt-2 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Client</th>
              <th class="py-2">Service</th>
              <th class="py-2">Period</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Paid</th>
              <th class="py-2">Balance</th>
              <th class="py-2">Due</th>
              <th class="py-2">Payment</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of contracts" class="border-t border-slate-100">
              <td class="py-3">
                <div class="font-medium text-slate-900">{{ getClientName(item) }}</div>
                <div class="text-xs text-slate-500">{{ item.title || '-' }}</div>
              </td>
              <td class="py-3">{{ getServiceName(item) }}</td>
              <td class="py-3">{{ formatPeriod(item.billingPeriod) }}</td>
              <td class="py-3">{{ formatMoney(item.amount, resolveCurrency(item.currency)) }}</td>
              <td class="py-3">{{ formatMoney(item.paidTotal || 0, resolveCurrency(item.currency)) }}</td>
              <td class="py-3">{{ formatMoney(item.balance || 0, resolveCurrency(item.currency)) }}</td>
              <td class="py-3">{{ formatDate(item.endDate) }}</td>
              <td class="py-3">
                <span
                  class="rounded-full px-2 py-1 text-xs"
                  [ngClass]="financialStatusClass(resolveFinancialStatus(item))"
                >
                  {{ formatFinancialStatus(resolveFinancialStatus(item)) }}
                </span>
              </td>
              <td class="py-3">
                <span class="rounded-full px-2 py-1 text-xs" [ngClass]="statusClass(item.status)">
                  {{ formatStatus(item.status) }}
                </span>
              </td>
              <td class="py-3 text-right">
                <button class="text-xs text-slate-700" (click)="openEdit(item)">Edit</button>
                <button
                  class="ml-3 text-xs text-amber-600"
                  (click)="cancel(item)"
                  [disabled]="item.status === 'cancelled'"
                >
                  Cancel
                </button>
                <button class="ml-3 text-xs text-slate-400" (click)="remove(item)">Delete</button>
              </td>
            </tr>
            <tr *ngIf="contracts.length === 0 && !isLoading">
              <td colspan="10" class="py-6 text-center text-sm text-slate-500">
                No contracts found
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
      <div class="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">{{ editing ? 'Edit contract' : 'New contract' }}</div>
          <button class="text-slate-400" (click)="closeModal()">X</button>
        </div>

        <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="save()">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Client</label>
              <select
                formControlName="clientId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select client</option>
                <option *ngFor="let client of clients" [value]="client._id">
                  {{ client.name }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Service</label>
              <select
                formControlName="serviceId"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Select service</option>
                <option *ngFor="let service of services" [value]="service._id">
                  {{ service.name }}
                </option>
              </select>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Title</label>
              <input
                formControlName="title"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Hosting principal"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Status</label>
              <select
                formControlName="status"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-4">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Period</label>
              <select
                formControlName="billingPeriod"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
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
                <option *ngFor="let currency of currencies" [value]="currency">
                  {{ currency }}
                </option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Start</label>
              <input
                formControlName="startDate"
                type="date"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">End date</label>
            <input
              formControlName="endDate"
              type="date"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div *ngIf="form.value.billingPeriod === 'one_time'" class="mt-1 text-xs text-slate-400">
              Optional for one-time contracts.
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Notes</label>
            <textarea
              formControlName="notes"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows="3"
            ></textarea>
          </div>

          <div *ngIf="validationError" class="text-sm text-red-600">{{ validationError }}</div>

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
export class ContractsComponent implements OnInit {
  contracts: ContractItem[] = [];
  clients: ClientItem[] = [];
  services: ServiceItem[] = [];
  isLoading = false;
  isSaving = false;
  isModalOpen = false;
  error = '';
  validationError = '';

  search = '';
  statusFilter = '';
  clientFilter = '';
  dueFrom = '';
  dueTo = '';

  editing: ContractItem | null = null;
  form: FormGroup;
  currencies: Array<'USD' | 'NIO'> = ['USD', 'NIO'];

  constructor(
    private readonly fb: FormBuilder,
    private readonly contractsApi: ContractsApiService,
    private readonly clientsApi: ClientsApiService,
    private readonly servicesApi: ServicesApiService,
    private readonly confirm: ConfirmService,
  ) {
    this.form = this.fb.group({
      clientId: ['', [Validators.required]],
      serviceId: ['', [Validators.required]],
      title: [''],
      billingPeriod: ['monthly', [Validators.required]],
      amount: [0, [Validators.required, Validators.min(0)]],
      currency: ['USD', [Validators.required]],
      startDate: ['', [Validators.required]],
      endDate: [''],
      status: ['active'],
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

    this.servicesApi.list().subscribe({
      next: (items) => {
        this.services = items.filter((service) => service.isActive);
      },
    });
  }

  load() {
    this.isLoading = true;
    this.error = '';
    this.contractsApi
      .list({
        search: this.search || undefined,
        status: this.statusFilter || undefined,
        clientId: this.clientFilter || undefined,
        dueFrom: this.dueFrom || undefined,
        dueTo: this.dueTo || undefined,
      })
      .subscribe({
        next: (response) => {
          this.contracts = response.items;
          this.isLoading = false;
        },
        error: () => {
          this.error = 'Unable to load list';
          this.isLoading = false;
        },
      });
  }

  openCreate() {
    this.editing = null;
    this.validationError = '';
    this.form.reset({
      clientId: '',
      serviceId: '',
      title: '',
      billingPeriod: 'monthly',
      amount: 0,
      currency: 'USD',
      startDate: '',
      endDate: '',
      status: 'active',
      notes: '',
    });
    this.isModalOpen = true;
  }

  openEdit(item: ContractItem) {
    this.editing = item;
    this.validationError = '';
    this.form.reset({
      clientId: this.getClientId(item),
      serviceId: this.getServiceId(item),
      title: item.title ?? '',
      billingPeriod: item.billingPeriod,
      amount: item.amount,
      currency: this.resolveCurrency(item.currency),
      startDate: this.toDateInput(item.startDate),
      endDate: this.toDateInput(item.endDate),
      status: item.status,
      notes: item.notes ?? '',
    });
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  async save() {
    if (this.form.invalid) {
      return;
    }

    const billingPeriod = this.form.value.billingPeriod as 'monthly' | 'annual' | 'one_time';
    const endDate = this.form.value.endDate || undefined;
    if (billingPeriod !== 'one_time' && !endDate) {
      this.validationError = 'End date is required for recurring contracts';
      return;
    }

    if (this.form.dirty) {
      const confirmed = await this.confirm.open({
        title: this.editing ? 'Confirm update' : 'Confirm create',
        message: this.editing
          ? 'Save changes to this contract?'
          : 'Create this contract with the current details?',
      });
      if (!confirmed) {
        return;
      }
    }

    this.isSaving = true;
    this.validationError = '';
    const payload = {
      clientId: this.form.value.clientId ?? '',
      serviceId: this.form.value.serviceId ?? '',
      title: this.form.value.title || undefined,
      billingPeriod,
      amount: Number(this.form.value.amount ?? 0),
      currency: this.form.value.currency || 'USD',
      startDate: this.form.value.startDate ?? '',
      endDate,
      status: (this.form.value.status || 'active') as 'active' | 'expired' | 'cancelled',
      notes: this.form.value.notes || undefined,
    };

    if (this.editing) {
      this.contractsApi.update(this.editing._id, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.isModalOpen = false;
          this.load();
        },
        error: () => {
          this.isSaving = false;
          this.error = 'Unable to save contract';
        },
      });
      return;
    }

    this.contractsApi.create(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.load();
      },
      error: () => {
        this.isSaving = false;
        this.error = 'Unable to create contract';
      },
    });
  }

  async cancel(item: ContractItem) {
    if (item.status === 'cancelled') {
      return;
    }
    const confirmed = await this.confirm.open({
      title: 'Confirm cancel',
      message: `Cancel contract ${item.title || item._id}?`,
      confirmText: 'Cancel contract',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.contractsApi.cancel(item._id).subscribe({
      next: () => this.load(),
      error: () => {
        this.error = 'Unable to cancel contract';
      },
    });
  }

  async remove(item: ContractItem) {
    const confirmed = await this.confirm.open({
      title: 'Confirm delete',
      message: `Delete contract ${item.title || item._id}? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.contractsApi.remove(item._id).subscribe({
      next: () => this.load(),
      error: () => {
        this.error = 'Unable to delete contract';
      },
    });
  }

  getClientName(item: ContractItem) {
    if (typeof item.clientId === 'string') {
      return this.clients.find((client) => client._id === item.clientId)?.name ?? item.clientId;
    }
    return item.clientId?.name ?? '-';
  }

  getServiceName(item: ContractItem) {
    if (typeof item.serviceId === 'string') {
      return this.services.find((service) => service._id === item.serviceId)?.name ?? item.serviceId;
    }
    return item.serviceId?.name ?? '-';
  }

  getClientId(item: ContractItem) {
    return typeof item.clientId === 'string' ? item.clientId : item.clientId?._id ?? '';
  }

  getServiceId(item: ContractItem) {
    return typeof item.serviceId === 'string' ? item.serviceId : item.serviceId?._id ?? '';
  }

  formatPeriod(period: 'monthly' | 'annual' | 'one_time') {
    if (period === 'monthly') {
      return 'Monthly';
    }
    if (period === 'annual') {
      return 'Annual';
    }
    return 'One-time';
  }

  formatStatus(status: 'active' | 'expired' | 'cancelled') {
    if (status === 'active') {
      return 'Active';
    }
    if (status === 'expired') {
      return 'Expired';
    }
    return 'Cancelled';
  }

  resolveFinancialStatus(item: ContractItem) {
    if (item.financialStatus) {
      return item.financialStatus;
    }
    const balance = (item.balance ?? (item.amount - (item.paidTotal ?? 0)));
    if (balance <= 0) {
      return 'paid';
    }
    if ((item.paidTotal ?? 0) > 0) {
      return 'partial';
    }
    return 'unpaid';
  }

  formatFinancialStatus(status: 'paid' | 'partial' | 'unpaid') {
    if (status === 'paid') {
      return 'Paid';
    }
    if (status === 'partial') {
      return 'Partial';
    }
    return 'Unpaid';
  }

  financialStatusClass(status: 'paid' | 'partial' | 'unpaid') {
    if (status === 'paid') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (status === 'partial') {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-rose-100 text-rose-700';
  }

  statusClass(status: 'active' | 'expired' | 'cancelled') {
    if (status === 'active') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (status === 'expired') {
      return 'bg-amber-100 text-amber-700';
    }
    return 'bg-slate-100 text-slate-500';
  }

  formatDate(date?: string) {
    if (!date) {
      return '-';
    }
    return new Date(date).toLocaleDateString('en-US');
  }

  toDateInput(date?: string) {
    if (!date) {
      return '';
    }
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  }

  formatMoney(amount: number, currency: string) {
    const value = Number(amount ?? 0).toFixed(2);
    return `${currency} ${value}`;
  }

  resolveCurrency(currency?: string): 'USD' | 'NIO' {
    return currency === 'NIO' ? 'NIO' : 'USD';
  }
}
