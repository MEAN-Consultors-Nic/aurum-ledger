import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ClientsApiService } from '../../core/services/clients-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ClientItem } from '../../core/models/client.model';

@Component({
  selector: 'app-clients',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-2xl font-semibold">Clients</div>
          <div class="text-sm text-slate-500">Active clients and history management</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          New client
        </button>
      </div>

      <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div class="flex-1">
          <input
            type="text"
            [(ngModel)]="search"
            (keyup.enter)="load()"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            placeholder="Search by name"
          />
        </div>
        <div class="flex gap-2">
          <button class="text-xs text-slate-600" (click)="setStatusFilter('all')">All</button>
          <button class="text-xs text-slate-600" (click)="setStatusFilter('active')">Active</button>
          <button class="text-xs text-slate-600" (click)="setStatusFilter('inactive')">Inactive</button>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div *ngIf="isLoading" class="text-sm text-slate-500">Loading clients...</div>
        <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

        <table *ngIf="!isLoading" class="mt-2 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Client</th>
              <th class="py-2">Contact</th>
              <th class="py-2">Phone</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of clients" class="border-t border-slate-100">
              <td class="py-3">
                <div class="font-medium text-slate-900">{{ item.name }}</div>
                <div class="text-xs text-slate-500">{{ item.email || '-' }}</div>
              </td>
              <td class="py-3">{{ item.contactName || '-' }}</td>
              <td class="py-3">{{ item.phone || '-' }}</td>
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
            <tr *ngIf="clients.length === 0 && !isLoading">
              <td colspan="5" class="py-6 text-center text-sm text-slate-500">
                No clients found
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
          <div class="text-lg font-semibold">{{ editing ? 'Edit client' : 'New client' }}</div>
          <button class="text-slate-400" (click)="closeModal()">X</button>
        </div>

        <form class="mt-4 space-y-4" [formGroup]="form" (ngSubmit)="save()">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
              <input
                formControlName="name"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Client name"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Contact</label>
              <input
                formControlName="contactName"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Contact person"
              />
            </div>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Email</label>
              <input
                formControlName="email"
                type="email"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Phone</label>
              <input
                formControlName="phone"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
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

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Tags (comma-separated)</label>
            <input
              formControlName="tags"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="VIP, hosting, support"
            />
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
export class ClientsComponent implements OnInit {
  clients: ClientItem[] = [];
  isLoading = false;
  isSaving = false;
  error = '';
  isModalOpen = false;
  editing: ClientItem | null = null;
  search = '';
  statusFilter: 'all' | 'active' | 'inactive' = 'all';

  form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly clientsApi: ClientsApiService,
    private readonly confirm: ConfirmService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      contactName: [''],
      email: [''],
      phone: [''],
      notes: [''],
      tags: [''],
      isActive: [true],
    });
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.error = '';
    this.clientsApi
      .list({
        search: this.search || undefined,
        isActive: this.statusFilter === 'all' ? undefined : this.statusFilter === 'active',
      })
      .subscribe({
        next: (response) => {
          this.clients = response.items;
          this.isLoading = false;
        },
        error: () => {
          this.error = 'Unable to load clients';
          this.isLoading = false;
        },
      });
  }

  setStatusFilter(filter: 'all' | 'active' | 'inactive') {
    this.statusFilter = filter;
    this.load();
  }

  openCreate() {
    this.editing = null;
    this.form.reset({
      name: '',
      contactName: '',
      email: '',
      phone: '',
      notes: '',
      tags: '',
      isActive: true,
    });
    this.isModalOpen = true;
  }

  openEdit(item: ClientItem) {
    this.editing = item;
    this.form.reset({
      name: item.name,
      contactName: item.contactName ?? '',
      email: item.email ?? '',
      phone: item.phone ?? '',
      notes: item.notes ?? '',
      tags: item.tags?.join(', ') ?? '',
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
          ? 'Save changes to this client?'
          : 'Create this client with the current details?',
      });
      if (!confirmed) {
        return;
      }
    }

    this.isSaving = true;
    const tagsRaw = this.form.value.tags || '';
    const tags = String(tagsRaw)
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const basePayload = {
      name: this.form.value.name ?? '',
      contactName: this.form.value.contactName || undefined,
      email: this.form.value.email || undefined,
      phone: this.form.value.phone || undefined,
      notes: this.form.value.notes || undefined,
      tags: tags.length > 0 ? tags : undefined,
    };

    if (this.editing) {
      this.clientsApi
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
            this.error = 'Unable to save client';
          },
        });
      return;
    }

    this.clientsApi.create(basePayload).subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.load();
      },
      error: () => {
        this.isSaving = false;
        this.error = 'Unable to create client';
      },
    });
  }

  toggleStatus(item: ClientItem) {
    this.confirm
      .open({
        title: item.isActive ? 'Confirm deactivation' : 'Confirm activation',
        message: item.isActive
          ? `Deactivate client ${item.name}?`
          : `Activate client ${item.name}?`,
        confirmText: item.isActive ? 'Deactivate' : 'Activate',
      })
      .then((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.clientsApi.update(item._id, { isActive: !item.isActive }).subscribe({
          next: () => this.load(),
          error: () => {
            this.error = 'Unable to update status';
          },
        });
      });
  }

  async remove(item: ClientItem) {
    const confirmed = await this.confirm.open({
      title: 'Confirm delete',
      message: `Delete client ${item.name}? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.clientsApi.remove(item._id).subscribe({
      next: () => this.load(),
      error: () => {
        this.error = 'Unable to delete client';
      },
    });
  }
}
