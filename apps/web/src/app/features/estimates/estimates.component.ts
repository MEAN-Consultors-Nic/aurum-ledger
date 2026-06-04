import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientsApiService } from '../../core/services/clients-api.service';
import { EstimatesApiService } from '../../core/services/estimates-api.service';
import { ServicesApiService } from '../../core/services/services-api.service';
import { ClientItem } from '../../core/models/client.model';
import { EstimateItem } from '../../core/models/estimate.model';
import { ServiceItem } from '../../core/models/service.model';

@Component({
  selector: 'app-estimates',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-2xl font-semibold">Estimates</div>
          <div class="text-sm text-slate-500">Estimate management and contract conversion</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          New estimate
        </button>
      </div>

      <div class="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-4">
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
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="converted">Converted</option>
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
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="load()"
        >
          Filter
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div *ngIf="isLoading" class="text-sm text-slate-500">Loading estimates...</div>
        <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

        <table *ngIf="!isLoading" class="mt-2 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Client</th>
              <th class="py-2">Service</th>
              <th class="py-2">Period</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Status</th>
              <th class="py-2">Created</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of estimates" class="border-t border-slate-100">
              <td class="py-3">
                <div class="font-medium text-slate-900">{{ getClientName(item) }}</div>
                <div class="text-xs text-slate-500">{{ item.title || '-' }}</div>
              </td>
              <td class="py-3">{{ getServiceName(item) }}</td>
              <td class="py-3">{{ formatPeriod(item.billingPeriod) }}</td>
              <td class="py-3">{{ formatMoney(item.amount, item.currency) }}</td>
              <td class="py-3">
                <span class="rounded-full px-2 py-1 text-xs" [ngClass]="statusClass(item.status)">
                  {{ formatStatus(item.status) }}
                </span>
              </td>
              <td class="py-3">{{ formatDate(item.createdAt) }}</td>
              <td class="py-3 text-right">
                <button
                  class="text-xs text-slate-700"
                  (click)="openNotes(item)"
                  [disabled]="!hasNotes(item)"
                >
                  Notes
                </button>
                <button
                  class="ml-3 text-xs text-slate-700"
                  (click)="openEdit(item)"
                  [disabled]="item.status === 'converted'"
                >
                  Edit
                </button>
                <button
                  *ngIf="item.status !== 'converted' && item.status !== 'rejected' && item.status !== 'expired'"
                  class="ml-3 text-xs text-emerald-600"
                  (click)="openConvert(item)"
                >
                  Convert
                </button>
                <button class="ml-3 text-xs text-slate-400" (click)="remove(item)">Delete</button>
              </td>
            </tr>
            <tr *ngIf="estimates.length === 0 && !isLoading">
              <td colspan="7" class="py-6 text-center text-sm text-slate-500">
                No estimates found
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
          <div class="text-lg font-semibold">{{ editing ? 'Edit estimate' : 'New estimate' }}</div>
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
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
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

    <div
      *ngIf="isConvertOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">Convert to contract</div>
          <button class="text-slate-400" (click)="closeConvert()">X</button>
        </div>

        <form class="mt-4 space-y-4" [formGroup]="convertForm" (ngSubmit)="convert()">
          <div class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            Adjust the price and add notes before creating the contract.
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
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Start</label>
              <input
                formControlName="startDate"
                type="date"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div *ngIf="convertForm.value.billingPeriod !== 'one_time'">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">End</label>
              <input
                formControlName="endDate"
                type="date"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Contract notes</label>
              <textarea
                formControlName="contractNotes"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows="3"
              ></textarea>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Conversion notes</label>
              <textarea
                formControlName="conversionNotes"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                rows="3"
              ></textarea>
            </div>
          </div>

          <div *ngIf="convertError" class="text-sm text-red-600">{{ convertError }}</div>

          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm text-slate-500" (click)="closeConvert()">
              Cancel
            </button>
            <button
              type="submit"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white"
              [disabled]="convertForm.invalid || isConverting"
            >
              {{ isConverting ? 'Converting...' : 'Convert' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div
      *ngIf="isNotesOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div class="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">Notes</div>
          <div class="flex items-center gap-2">
            <button
              class="rounded border border-slate-200 px-3 py-1 text-xs uppercase tracking-wide text-slate-700"
              (click)="copyNotes()"
              [disabled]="!notesPreview"
            >
              {{ copyLabel }}
            </button>
            <button class="text-slate-400" (click)="closeNotes()">X</button>
          </div>
        </div>

        <div class="mt-2 text-xs text-slate-500">
          <div>{{ notesClient || 'Client' }}</div>
          <div>{{ notesTitle || 'Untitled estimate' }}</div>
        </div>

        <div class="mt-4 max-h-[60vh] overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          <div class="whitespace-pre-wrap">{{ notesPreview || 'No notes available.' }}</div>
        </div>
      </div>
    </div>
  `,
})
export class EstimatesComponent implements OnInit {
  estimates: EstimateItem[] = [];
  clients: ClientItem[] = [];
  services: ServiceItem[] = [];
  currencies: Array<'USD' | 'NIO'> = ['USD', 'NIO'];

  isLoading = false;
  isSaving = false;
  isConverting = false;
  error = '';
  validationError = '';
  convertError = '';
  isModalOpen = false;
  isConvertOpen = false;
  isNotesOpen = false;
  editing: EstimateItem | null = null;
  converting: EstimateItem | null = null;
  notesPreview = '';
  notesTitle = '';
  notesClient = '';
  copyLabel = 'Copy';
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  search = '';
  statusFilter = '';
  clientFilter = '';

  form: FormGroup;
  convertForm: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly estimatesApi: EstimatesApiService,
    private readonly clientsApi: ClientsApiService,
    private readonly servicesApi: ServicesApiService,
  ) {
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      serviceId: ['', Validators.required],
      title: [''],
      billingPeriod: ['monthly', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      currency: ['USD', Validators.required],
      status: ['draft', Validators.required],
      notes: [''],
    });

    this.convertForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(0)]],
      billingPeriod: ['monthly'],
      startDate: ['', Validators.required],
      endDate: [''],
      contractNotes: [''],
      conversionNotes: [''],
    });
  }

  ngOnInit() {
    this.load();
    this.loadReferences();
  }

  loadReferences() {
    this.clientsApi.list().subscribe({
      next: (response) => (this.clients = response.items),
      error: () => {
        this.error = 'Unable to load clients';
      },
    });
    this.servicesApi.list().subscribe({
      next: (items) => (this.services = items),
      error: () => {
        this.error = 'Unable to load services';
      },
    });
  }

  load() {
    this.isLoading = true;
    this.error = '';
    this.estimatesApi
      .list({
        clientId: this.clientFilter || undefined,
        status: this.statusFilter || undefined,
        search: this.search || undefined,
      })
      .subscribe({
        next: (response) => {
          this.estimates = response.items;
          this.isLoading = false;
        },
        error: () => {
        this.error = 'Unable to load estimates';
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
      status: 'draft',
      notes: '',
    });
    this.isModalOpen = true;
  }

  openEdit(item: EstimateItem) {
    this.editing = item;
    this.validationError = '';
    this.form.reset({
      clientId: this.resolveId(item.clientId),
      serviceId: this.resolveId(item.serviceId),
      title: item.title ?? '',
      billingPeriod: item.billingPeriod,
      amount: item.amount,
      currency: item.currency,
      status: item.status === 'converted' ? 'accepted' : item.status,
      notes: item.notes ?? '',
    });
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  save() {
    if (this.form.invalid) {
      this.validationError = 'Complete the required fields';
      return;
    }
    this.isSaving = true;
    this.validationError = '';

    const payload = {
      clientId: this.form.value.clientId ?? '',
      serviceId: this.form.value.serviceId ?? '',
      title: this.form.value.title || undefined,
      billingPeriod: this.form.value.billingPeriod ?? 'monthly',
      amount: Number(this.form.value.amount ?? 0),
      currency: this.form.value.currency ?? 'USD',
      status: this.form.value.status ?? 'draft',
      notes: this.form.value.notes || undefined,
    };

    if (this.editing) {
      this.estimatesApi.update(this.editing._id, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.isModalOpen = false;
          this.load();
        },
        error: () => {
          this.isSaving = false;
          this.validationError = 'Unable to save estimate';
        },
      });
      return;
    }

    this.estimatesApi.create(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.load();
      },
      error: () => {
        this.isSaving = false;
        this.validationError = 'Unable to create estimate';
      },
    });
  }

  remove(item: EstimateItem) {
    this.estimatesApi.remove(item._id).subscribe({
      next: () => this.load(),
      error: () => {
        this.error = 'Unable to delete estimate';
      },
    });
  }

  openConvert(item: EstimateItem) {
    this.converting = item;
    this.convertError = '';
    this.convertForm.reset({
      amount: item.amount,
      billingPeriod: item.billingPeriod,
      startDate: this.todayISO(),
      endDate: '',
      contractNotes: item.notes ?? '',
      conversionNotes: '',
    });
    this.isConvertOpen = true;
  }

  closeConvert() {
    this.isConvertOpen = false;
    this.converting = null;
  }

  openNotes(item: EstimateItem) {
    this.notesPreview = (item.notes ?? '').trim();
    this.notesTitle = item.title ?? '';
    this.notesClient = this.getClientName(item);
    this.resetCopyLabel();
    this.isNotesOpen = true;
  }

  closeNotes() {
    this.isNotesOpen = false;
    this.notesPreview = '';
    this.notesTitle = '';
    this.notesClient = '';
    this.resetCopyLabel();
  }

  copyNotes() {
    if (!this.notesPreview) {
      return;
    }
    navigator.clipboard
      ?.writeText(this.notesPreview)
      .then(() => this.setCopyLabel('Copied'))
      .catch(() => this.setCopyLabel('Failed'));
  }

  hasNotes(item: EstimateItem) {
    return Boolean((item.notes ?? '').trim());
  }

  private setCopyLabel(label: string) {
    this.copyLabel = label;
    if (this.copyTimer) {
      clearTimeout(this.copyTimer);
    }
    this.copyTimer = setTimeout(() => {
      this.copyLabel = 'Copy';
      this.copyTimer = null;
    }, 2000);
  }

  private resetCopyLabel() {
    if (this.copyTimer) {
      clearTimeout(this.copyTimer);
      this.copyTimer = null;
    }
    this.copyLabel = 'Copy';
  }

  convert() {
    if (this.convertForm.invalid || !this.converting) {
      this.convertError = 'Complete the required information';
      return;
    }
    this.isConverting = true;
    this.convertError = '';

    const payload = {
      amount: Number(this.convertForm.value.amount ?? 0),
      billingPeriod: this.convertForm.value.billingPeriod ?? this.converting.billingPeriod,
      startDate: this.convertForm.value.startDate ?? '',
      endDate: this.convertForm.value.endDate || undefined,
      contractNotes: this.convertForm.value.contractNotes || undefined,
      conversionNotes: this.convertForm.value.conversionNotes || undefined,
    };

    this.estimatesApi.convert(this.converting._id, payload).subscribe({
      next: () => {
        this.isConverting = false;
        this.isConvertOpen = false;
        this.converting = null;
        this.load();
      },
      error: () => {
        this.isConverting = false;
        this.convertError = 'Unable to convert estimate';
      },
    });
  }

  getClientName(item: EstimateItem) {
    if (typeof item.clientId === 'string') {
      return this.clients.find((client) => client._id === item.clientId)?.name ?? 'Client';
    }
    return item.clientId?.name ?? 'Client';
  }

  getServiceName(item: EstimateItem) {
    if (typeof item.serviceId === 'string') {
      return this.services.find((service) => service._id === item.serviceId)?.name ?? 'Service';
    }
    return item.serviceId?.name ?? 'Service';
  }

  resolveId(value: string | { _id: string }) {
    return typeof value === 'string' ? value : value?._id;
  }

  formatPeriod(period?: string) {
    switch (period) {
      case 'monthly':
        return 'Monthly';
      case 'annual':
        return 'Annual';
      case 'one_time':
        return 'One-time';
      default:
        return 'N/A';
    }
  }

  formatStatus(status: EstimateItem['status']) {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'sent':
        return 'Sent';
      case 'accepted':
        return 'Accepted';
      case 'rejected':
        return 'Rejected';
      case 'expired':
        return 'Expired';
      case 'converted':
        return 'Converted';
      default:
        return status;
    }
  }

  statusClass(status: EstimateItem['status']) {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-600';
      case 'sent':
        return 'bg-blue-100 text-blue-700';
      case 'accepted':
        return 'bg-emerald-100 text-emerald-700';
      case 'rejected':
        return 'bg-rose-100 text-rose-700';
      case 'expired':
        return 'bg-amber-100 text-amber-700';
      case 'converted':
        return 'bg-indigo-100 text-indigo-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  formatMoney(amount: number, currency: 'USD' | 'NIO') {
    const label = currency ?? 'USD';
    return `${label} ${Number(amount || 0).toFixed(2)}`;
  }

  formatDate(value?: string) {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleDateString('en-US');
  }

  todayISO() {
    const now = new Date();
    return now.toISOString().slice(0, 10);
  }
}
