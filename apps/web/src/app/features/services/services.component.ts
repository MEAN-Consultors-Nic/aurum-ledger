import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ServicesApiService } from '../../core/services/services-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ServiceItem } from '../../core/models/service.model';

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-2xl font-semibold">Services</div>
          <div class="text-sm text-slate-500">Service catalog and configuration</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          New service
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div *ngIf="isLoading" class="text-sm text-slate-500">Loading services...</div>
        <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

        <table *ngIf="!isLoading" class="mt-2 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Name</th>
              <th class="py-2">Type</th>
              <th class="py-2">Period</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of services" class="border-t border-slate-100">
              <td class="py-3">
                <div class="font-medium text-slate-900">{{ item.name }}</div>
                <div class="text-xs text-slate-500">{{ item.description || 'No description' }}</div>
              </td>
              <td class="py-3">{{ item.billingType === 'recurring' ? 'Recurring' : 'One-time' }}</td>
              <td class="py-3">{{ formatPeriod(item.defaultPeriod) }}</td>
              <td class="py-3">
                <span
                  class="rounded-full px-2 py-1 text-xs"
                  [ngClass]="item.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                >
                  {{ item.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="py-3 text-right">
                <button class="text-xs text-slate-700" (click)="openEdit(item)">Edit</button>
                <button class="ml-3 text-xs text-red-600" (click)="toggleStatus(item)">
                  {{ item.isActive ? 'Deactivate' : 'Activate' }}
                </button>
                <button class="ml-3 text-xs text-slate-400" (click)="remove(item)">Delete</button>
              </td>
            </tr>
            <tr *ngIf="services.length === 0 && !isLoading">
              <td colspan="5" class="py-6 text-center text-sm text-slate-500">
                No services found
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
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">{{ editing ? 'Edit service' : 'New service' }}</div>
          <button class="text-slate-400" (click)="closeModal()">X</button>
        </div>

        <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="save()">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
            <input
              formControlName="name"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Hosting, Soporte, Website..."
            />
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Type</label>
              <select
                formControlName="billingType"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="recurring">Recurring</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Period</label>
              <select
                formControlName="defaultPeriod"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Not set</option>
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="one_time">One-time</option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Description</label>
            <textarea
              formControlName="description"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              rows="3"
            ></textarea>
          </div>

          <div *ngIf="editing" class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" formControlName="isActive" class="h-4 w-4" />
            <span>Active</span>
          </div>

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
export class ServicesComponent implements OnInit {
  services: ServiceItem[] = [];
  isLoading = false;
  isSaving = false;
  error = '';
  isModalOpen = false;
  editing: ServiceItem | null = null;

  constructor(
    private readonly fb: FormBuilder,
    private readonly servicesApi: ServicesApiService,
    private readonly confirm: ConfirmService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      billingType: ['recurring', [Validators.required]],
      defaultPeriod: [''],
      description: [''],
      isActive: [true],
    });
  }

  form: FormGroup;

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.error = '';
    this.servicesApi.list().subscribe({
      next: (items) => {
        this.services = items;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Unable to load catalog';
        this.isLoading = false;
      },
    });
  }

  openCreate() {
    this.editing = null;
    this.form.reset({
      name: '',
      billingType: 'recurring',
      defaultPeriod: '',
      description: '',
      isActive: true,
    });
    this.isModalOpen = true;
  }

  openEdit(item: ServiceItem) {
    this.editing = item;
    this.form.reset({
      name: item.name,
      billingType: item.billingType,
      defaultPeriod: item.defaultPeriod ?? '',
      description: item.description ?? '',
      isActive: item.isActive,
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
    if (this.form.dirty) {
      const confirmed = await this.confirm.open({
        title: this.editing ? 'Confirm update' : 'Confirm create',
        message: this.editing
          ? 'Save changes to this service?'
          : 'Create this service with the current details?',
      });
      if (!confirmed) {
        return;
      }
    }

    this.isSaving = true;
    const defaultPeriod = (this.form.value.defaultPeriod || undefined) as
      | 'monthly'
      | 'annual'
      | 'one_time'
      | undefined;
    const basePayload = {
      name: this.form.value.name ?? '',
      billingType: (this.form.value.billingType ?? 'recurring') as 'recurring' | 'one_time',
      defaultPeriod,
      description: this.form.value.description || undefined,
    };

    if (this.editing) {
      this.servicesApi
        .update(this.editing._id, {
          ...basePayload,
          isActive: this.form.value.isActive ?? true,
        })
        .subscribe({
          next: () => {
            this.isSaving = false;
            this.isModalOpen = false;
            this.load();
          },
          error: () => {
            this.isSaving = false;
            this.error = 'Unable to save service';
          },
        });
      return;
    }

    this.servicesApi.create(basePayload).subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.load();
      },
      error: () => {
        this.isSaving = false;
        this.error = 'Unable to create service';
      },
    });
  }

  toggleStatus(item: ServiceItem) {
    this.confirm
      .open({
        title: item.isActive ? 'Confirm deactivation' : 'Confirm activation',
        message: item.isActive
          ? `Deactivate service ${item.name}?`
          : `Activate service ${item.name}?`,
        confirmText: item.isActive ? 'Deactivate' : 'Activate',
      })
      .then((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.servicesApi.update(item._id, { isActive: !item.isActive }).subscribe({
          next: () => this.load(),
          error: () => {
            this.error = 'Unable to update status';
          },
        });
      });
  }

  async remove(item: ServiceItem) {
    const confirmed = await this.confirm.open({
      title: 'Confirm delete',
      message: `Delete service ${item.name}? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.servicesApi.remove(item._id).subscribe({
      next: () => this.load(),
      error: () => {
        this.error = 'Unable to delete service';
      },
    });
  }

  formatPeriod(period?: 'monthly' | 'annual' | 'one_time') {
    if (!period) {
      return '-';
    }
    if (period === 'monthly') {
      return 'Monthly';
    }
    if (period === 'annual') {
      return 'Annual';
    }
    return 'One-time';
  }
}
