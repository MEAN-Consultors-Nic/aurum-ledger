import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { UsersApiService } from '../../core/services/users-api.service';
import { AdminUser } from '../../core/models/admin-user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <div class="text-2xl font-semibold">Users</div>
          <div class="text-sm text-slate-500">Access and role management</div>
        </div>
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
          (click)="openCreate()"
        >
          New user
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div *ngIf="isLoading" class="text-sm text-slate-500">Loading users...</div>
        <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

        <table *ngIf="!isLoading" class="mt-2 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Name</th>
              <th class="py-2">Username</th>
              <th class="py-2">Email</th>
              <th class="py-2">Role</th>
              <th class="py-2">Status</th>
              <th class="py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let user of users" class="border-t border-slate-100">
              <td class="py-3">
                <div class="font-medium text-slate-900">{{ user.name }}</div>
              </td>
              <td class="py-3">{{ user.username || '-' }}</td>
              <td class="py-3">{{ user.email }}</td>
              <td class="py-3">{{ user.role === 'admin' ? 'Admin' : 'Staff' }}</td>
              <td class="py-3">
                <span
                  class="rounded-full px-2 py-1 text-xs"
                  [ngClass]="user.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'"
                >
                  {{ user.isActive ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td class="py-3 text-right">
                <button class="text-xs text-slate-700" (click)="openEdit(user)">Edit</button>
                <button class="ml-3 text-xs text-amber-600" (click)="toggleActive(user)">
                  {{ user.isActive ? 'Deactivate' : 'Activate' }}
                </button>
              </td>
            </tr>
            <tr *ngIf="users.length === 0 && !isLoading">
              <td colspan="6" class="py-6 text-center text-sm text-slate-500">
                No users found
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
          <div class="text-lg font-semibold">{{ editing ? 'Edit user' : 'New user' }}</div>
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

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Username</label>
            <input
              formControlName="username"
              type="text"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Email</label>
            <input
              formControlName="email"
              type="email"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Role</label>
            <select
              formControlName="role"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="admin">Admin</option>
              <option value="staff">Staff</option>
            </select>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {{ editing ? 'New password (optional)' : 'Password' }}
            </label>
            <input
              formControlName="password"
              type="password"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <div *ngIf="editing" class="mt-1 text-xs text-slate-500">
              Leave blank to keep the current password
            </div>
          </div>

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
export class UsersComponent implements OnInit {
  users: AdminUser[] = [];
  isLoading = false;
  isSaving = false;
  isModalOpen = false;
  error = '';
  editing: AdminUser | null = null;
  form: FormGroup;

  constructor(
    private readonly fb: FormBuilder,
    private readonly usersApi: UsersApiService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      username: ['', [Validators.required, Validators.minLength(3)]],
      email: ['', [Validators.required, Validators.email]],
      role: ['staff', [Validators.required]],
      password: [''],
    });
  }

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.error = '';
    this.usersApi.list().subscribe({
      next: (items) => {
        this.users = items;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Unable to load users';
        this.isLoading = false;
      },
    });
  }

  openCreate() {
    this.editing = null;
    this.setPasswordRequired(true);
    this.form.reset({
      name: '',
      username: '',
      email: '',
      role: 'staff',
      password: '',
    });
    this.isModalOpen = true;
  }

  openEdit(user: AdminUser) {
    this.editing = user;
    this.setPasswordRequired(false);
    this.form.reset({
      name: user.name,
      username: user.username ?? '',
      email: user.email,
      role: user.role,
      password: '',
    });
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
  }

  save() {
    if (this.form.invalid) {
      return;
    }

    this.isSaving = true;
    const payload = {
      name: this.form.value.name ?? '',
      username: this.form.value.username ?? '',
      email: this.form.value.email ?? '',
      role: (this.form.value.role || 'staff') as 'admin' | 'staff',
    };

    const password = this.form.value.password as string;

    if (this.editing) {
      const updatePayload: {
        name: string;
        username: string;
        email: string;
        role: 'admin' | 'staff';
        password?: string;
      } = {
        ...payload,
      };
      if (password && password.length >= 6) {
        updatePayload.password = password;
      }
      this.usersApi.update(this.editing.id, updatePayload).subscribe({
        next: () => {
          this.isSaving = false;
          this.isModalOpen = false;
          this.load();
        },
        error: () => {
          this.isSaving = false;
          this.error = 'Unable to save user';
        },
      });
      return;
    }

    this.usersApi
      .create({
        ...payload,
        password: password ?? '',
      })
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.isModalOpen = false;
          this.load();
        },
        error: () => {
          this.isSaving = false;
        this.error = 'Unable to create user';
        },
      });
  }

  toggleActive(user: AdminUser) {
    this.usersApi.toggleActive(user.id).subscribe({
      next: () => this.load(),
      error: () => {
        this.error = 'Unable to update status';
      },
    });
  }

  private setPasswordRequired(required: boolean) {
    const control = this.form.get('password');
    if (!control) {
      return;
    }
    if (required) {
      control.setValidators([Validators.required, Validators.minLength(6)]);
    } else {
      control.clearValidators();
    }
    control.updateValueAndValidity();
  }
}
