import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { SettingsApiService } from '../../core/services/settings-api.service';
import { CategoryItem } from '../../core/models/category.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <div class="text-2xl font-semibold">Settings</div>
        <div class="text-sm text-slate-500">Global system preferences</div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <form class="space-y-4" [formGroup]="form" (ngSubmit)="save()">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Category for payment income
            </label>
            <select
              formControlName="defaultPaymentCategoryId"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Select category</option>
              <option *ngFor="let category of incomeCategories" [value]="category._id">
                {{ category.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">USD to NIO exchange rate</label>
            <input
              formControlName="fxUsdToNio"
              type="number"
              step="0.01"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div *ngIf="message" class="text-sm text-emerald-600">{{ message }}</div>
          <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>

          <div class="flex justify-end">
            <button
              type="submit"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white"
              [disabled]="form.invalid || isSaving"
            >
              {{ isSaving ? 'Saving...' : 'Save changes' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  form: FormGroup;
  incomeCategories: CategoryItem[] = [];
  isSaving = false;
  error = '';
  message = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly settingsApi: SettingsApiService,
    private readonly categoriesApi: CategoriesApiService,
  ) {
    this.form = this.fb.group({
      defaultPaymentCategoryId: ['', [Validators.required]],
      fxUsdToNio: [36, [Validators.required, Validators.min(0.0001)]],
    });
  }

  ngOnInit() {
    this.loadCategories();
    this.loadSettings();
  }

  loadCategories() {
    this.categoriesApi.list({ type: 'income' }).subscribe({
      next: (items) => {
        this.incomeCategories = items;
      },
    });
  }

  loadSettings() {
    this.settingsApi.list().subscribe({
      next: (items) => {
        const map = new Map(items.map((item) => [item.key, item.value]));
        const categoryId = map.get('defaultPaymentCategoryId') ?? '';
        const fx = Number(map.get('fxUsdToNio') ?? 36);
        this.form.patchValue({
          defaultPaymentCategoryId: categoryId,
          fxUsdToNio: Number.isFinite(fx) ? fx : 36,
        });
      },
    });
  }

  save() {
    if (this.form.invalid) {
      return;
    }
    this.isSaving = true;
    this.error = '';
    this.message = '';

    const categoryId = this.form.value.defaultPaymentCategoryId ?? '';
    const fx = String(this.form.value.fxUsdToNio ?? 36);

    forkJoin([
      this.settingsApi.update('defaultPaymentCategoryId', categoryId),
      this.settingsApi.update('fxUsdToNio', fx),
    ]).subscribe({
      next: () => {
        this.isSaving = false;
        this.message = 'Settings updated';
      },
      error: () => {
        this.isSaving = false;
        this.error = 'Unable to save settings';
      },
    });
  }
}
