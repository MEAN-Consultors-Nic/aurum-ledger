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
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';
import {
  SendNotificationDialogComponent,
  SendNotificationConfig,
} from '../../shared/send-notification-dialog/send-notification-dialog.component';

@Component({
  selector: 'app-contracts',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    ActionMenuComponent,
    SendNotificationDialogComponent,
  ],
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
                <app-action-menu [items]="rowActions(item)" />
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

    <!-- Omit payment modal -->
    <div
      *ngIf="isOmitModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div class="text-lg font-semibold text-slate-900">Omit payment</div>
        <div class="mt-1 text-sm text-slate-600" *ngIf="omittingContract">
          {{ getClientName(omittingContract) }} ·
          <span class="font-medium">{{ formatMoney(omittingContract.balance || 0, resolveCurrency(omittingContract.currency)) }}</span>
          pending
        </div>
        <form class="mt-4 space-y-3" (ngSubmit)="confirmOmitPayment()">
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
            Why is this payment being omitted?
          </label>
          <textarea
            [(ngModel)]="omitNote"
            name="omitNote"
            rows="4"
            required
            minlength="3"
            placeholder="e.g. Client renegotiated, written off as bad debt, service was not delivered…"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          ></textarea>
          <div class="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This excludes the contract from outstanding receivables and reports. You can restore the
            payment later if needed.
          </div>
          <div *ngIf="omitError" class="text-sm text-rose-600">{{ omitError }}</div>
          <div class="mt-2 flex justify-end gap-3">
            <button
              type="button"
              class="rounded border border-slate-200 px-4 py-2 text-xs uppercase tracking-wide text-slate-700"
              (click)="closeOmitModal()"
              [disabled]="isOmitSaving"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded bg-amber-600 px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-50"
              [disabled]="!omitNote || omitNote.length < 3 || isOmitSaving"
            >
              {{ isOmitSaving ? 'Omitting...' : 'Omit payment' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Send notification dialog -->
    <app-send-notification-dialog
      [open]="isSendNotifOpen"
      [config]="sendNotifConfig"
      (closed)="closeSendNotif()"
    ></app-send-notification-dialog>
  `,
})
export class ContractsComponent implements OnInit {
  // Send-notification dialog state
  isSendNotifOpen = false;
  sendNotifConfig: SendNotificationConfig | null = null;

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

  // Omit payment modal state
  isOmitModalOpen = false;
  isOmitSaving = false;
  omittingContract: ContractItem | null = null;
  omitNote = '';
  omitError = '';

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

  rowActions(item: ContractItem): ActionMenuItem[] {
    const balance = item.balance ?? item.amount - (item.paidTotal ?? 0);
    const omitted = !!item.paymentOmittedAt;
    const now = Date.now();
    const endDate = item.endDate ? new Date(item.endDate).getTime() : 0;
    const daysUntilExpiry = endDate ? Math.ceil((endDate - now) / (24 * 60 * 60 * 1000)) : 0;
    const isExpiringSoon = endDate > 0 && daysUntilExpiry > 0 && daysUntilExpiry <= 60;
    const isExpired = endDate > 0 && endDate < now;
    const hasPendingBalance = balance > 0 && !omitted && item.status === 'active';

    const items: ActionMenuItem[] = [
      { label: 'Edit', action: () => this.openEdit(item) },
    ];

    // Send-notification actions — visible only when contextually relevant
    if (hasPendingBalance) {
      items.push({
        label: isExpired ? 'Send payment reminder' : 'Send payment reminder',
        action: () => this.openSendNotification(item, 'contract.payment_reminder', 'Send payment reminder'),
      });
    }
    if (hasPendingBalance && isExpired) {
      items.push({
        label: 'Send suspension notice',
        action: () => this.openSendNotification(item, 'contract.suspension_notice', 'Send suspension notice'),
      });
    }
    if (isExpiringSoon && item.status === 'active') {
      items.push({
        label: 'Send renewal reminder',
        action: () => this.openSendNotification(item, 'contract.expiring_soon', 'Send renewal reminder'),
      });
    }
    if (isExpired && item.status === 'active') {
      items.push({
        label: 'Send expired notice',
        action: () => this.openSendNotification(item, 'contract.expired', 'Send expired notice'),
      });
    }

    if (!omitted && balance > 0 && item.status === 'active') {
      items.push({
        label: 'Omit payment',
        action: () => this.openOmitPayment(item),
      });
    }
    if (omitted) {
      items.push({
        label: 'Restore payment',
        action: () => this.restorePayment(item),
      });
    }
    if (item.status !== 'cancelled') {
      items.push({
        label: 'Cancel contract',
        action: () => this.cancel(item),
      });
    }
    items.push({
      label: 'Delete',
      action: () => this.remove(item),
      danger: true,
    });
    return items;
  }

  openSendNotification(item: ContractItem, eventKey: string, title: string) {
    const clientName = this.getClientName(item);
    const balance = item.balance ?? item.amount - (item.paidTotal ?? 0);
    const subtitle = `${clientName} · ${item.title || 'contract'} · ${this.formatMoney(balance, this.resolveCurrency(item.currency))} pending`;
    this.sendNotifConfig = {
      title,
      subtitle,
      eventKey,
      contextType: 'contract',
      contextId: item._id,
      defaultRecipients: ['contract.client'],
      recipientSuggestions: [
        { label: 'Client', expression: 'contract.client', description: 'Email on file for the client' },
        { label: 'All admins', expression: 'admin', description: 'Active admin users' },
      ],
    };
    this.isSendNotifOpen = true;
  }

  closeSendNotif() {
    this.isSendNotifOpen = false;
    this.sendNotifConfig = null;
  }

  openOmitPayment(item: ContractItem) {
    this.omittingContract = item;
    this.omitNote = '';
    this.omitError = '';
    this.isOmitModalOpen = true;
  }

  closeOmitModal() {
    this.isOmitModalOpen = false;
    this.omittingContract = null;
    this.omitNote = '';
    this.omitError = '';
  }

  confirmOmitPayment() {
    if (!this.omittingContract || !this.omitNote || this.omitNote.length < 3) {
      return;
    }
    this.isOmitSaving = true;
    this.omitError = '';
    this.contractsApi.omitPayment(this.omittingContract._id, { note: this.omitNote }).subscribe({
      next: () => {
        this.isOmitSaving = false;
        this.closeOmitModal();
        this.load();
      },
      error: (err) => {
        this.isOmitSaving = false;
        this.omitError = err?.error?.message ?? 'Unable to omit payment';
      },
    });
  }

  async restorePayment(item: ContractItem) {
    const confirmed = await this.confirm.open({
      title: 'Restore payment',
      message: `Restore the pending payment for "${item.title || this.getClientName(item)}"? The balance will reappear in outstanding receivables.`,
      confirmText: 'Restore',
    });
    if (!confirmed) {
      return;
    }
    this.contractsApi.restorePayment(item._id).subscribe({
      next: () => this.load(),
      error: () => {
        this.error = 'Unable to restore payment';
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

  resolveFinancialStatus(item: ContractItem): 'paid' | 'partial' | 'unpaid' | 'omitted' {
    if (item.paymentOmittedAt) {
      return 'omitted';
    }
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

  formatFinancialStatus(status: 'paid' | 'partial' | 'unpaid' | 'omitted') {
    if (status === 'paid') return 'Paid';
    if (status === 'partial') return 'Partial';
    if (status === 'omitted') return 'Omitted';
    return 'Unpaid';
  }

  financialStatusClass(status: 'paid' | 'partial' | 'unpaid' | 'omitted') {
    if (status === 'paid') return 'bg-emerald-100 text-emerald-700';
    if (status === 'partial') return 'bg-amber-100 text-amber-700';
    if (status === 'omitted') return 'bg-slate-200 text-slate-600';
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
