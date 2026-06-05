import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import {
  GithubSettings,
  S3Settings,
  SettingsApiService,
  UpdateGithubSettingsPayload,
  UpdateS3SettingsPayload,
} from '../../core/services/settings-api.service';
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

      <!-- GitHub integration -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">GitHub integration</div>
            <div class="text-xs text-slate-500">
              Auto-create repos on contract conversion and surface recent activity on each project.
            </div>
          </div>
          <span
            *ngIf="githubSettings"
            class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            [ngClass]="githubSettings.hasToken
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'"
          >
            {{ githubSettings.hasToken ? 'Connected' : 'Not configured' }}
          </span>
        </div>

        <form class="mt-5 space-y-4" [formGroup]="githubForm" (ngSubmit)="saveGithub()">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
                GitHub organization
                <span class="text-slate-400">(optional)</span>
              </label>
              <input
                formControlName="org"
                placeholder="e.g. MEAN-Consultors-Nic"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div class="mt-1 text-[11px] text-slate-500">
                Leave blank to create repos under the token owner's account.
              </div>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Personal Access Token
              </label>
              <input
                formControlName="token"
                type="password"
                autocomplete="new-password"
                [placeholder]="githubSettings?.hasToken ? '••••••••• (configured — leave blank to keep)' : 'ghp_…'"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
              <div class="mt-1 text-[11px] text-slate-500">
                Needs <code>repo</code> scope (and org write if you target an org). Stored encrypted (AES-256-GCM).
              </div>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <label class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <input type="checkbox" formControlName="autoCreate" class="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <div>
                <div class="text-sm font-medium text-slate-900">Auto-create on conversion</div>
                <div class="text-[11px] text-slate-500">
                  When enabled, the "Create GitHub repo" box is pre-checked in the convert dialog.
                </div>
              </div>
            </label>
            <label class="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <input type="checkbox" formControlName="defaultPrivate" class="mt-0.5 h-4 w-4 rounded border-slate-300" />
              <div>
                <div class="text-sm font-medium text-slate-900">Private repos by default</div>
                <div class="text-[11px] text-slate-500">Recommended for client work.</div>
              </div>
            </label>
          </div>

          <div *ngIf="githubMessage" class="text-sm text-emerald-600">{{ githubMessage }}</div>
          <div *ngIf="githubError" class="text-sm text-red-600">{{ githubError }}</div>

          <div class="flex items-center justify-between">
            <button
              *ngIf="githubSettings?.hasToken"
              type="button"
              (click)="clearGithubToken()"
              [disabled]="isSavingGithub"
              class="text-xs font-semibold uppercase tracking-wide text-rose-600 hover:text-rose-800 disabled:opacity-40"
            >
              Disconnect token
            </button>
            <span *ngIf="!githubSettings?.hasToken"></span>
            <button
              type="submit"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-50"
              [disabled]="isSavingGithub"
            >
              {{ isSavingGithub ? 'Saving…' : 'Save GitHub settings' }}
            </button>
          </div>
        </form>
      </div>

      <!-- S3 attachments -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">S3 attachments</div>
            <div class="text-xs text-slate-500">
              File storage for attachments on estimates, contracts and projects.
              <span class="font-semibold text-slate-700">All objects stay private</span> — every upload and download uses short-lived signed URLs.
              Works with AWS S3, Cloudflare R2, Backblaze B2 or any S3-compatible endpoint.
            </div>
          </div>
          <span
            *ngIf="s3Settings"
            class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            [ngClass]="s3Settings.hasSecretKey
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-slate-100 text-slate-500'"
          >
            {{ s3Settings.hasSecretKey ? 'Connected' : 'Not configured' }}
          </span>
        </div>

        <form class="mt-5 space-y-4" [formGroup]="s3Form" (ngSubmit)="saveS3()">
          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Bucket</label>
              <input formControlName="bucket" placeholder="helm-attachments"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Region</label>
              <input formControlName="region" placeholder="us-east-1"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Access key ID</label>
              <input formControlName="accessKeyId" autocomplete="off"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Secret access key</label>
              <input
                formControlName="secretAccessKey"
                type="password"
                autocomplete="new-password"
                [placeholder]="s3Settings?.hasSecretKey ? '••••••••• (leave blank to keep)' : 'AWS secret access key'"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
              />
              <div class="mt-1 text-[11px] text-slate-500">
                Stored encrypted (AES-256-GCM). Never returned to the client.
              </div>
            </div>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Endpoint <span class="text-slate-400">(only for R2/B2/MinIO)</span>
            </label>
            <input
              formControlName="endpoint"
              placeholder="https://<accountid>.r2.cloudflarestorage.com (leave blank for AWS)"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm"
            />
          </div>

          <div *ngIf="s3Message" class="text-sm text-emerald-600">{{ s3Message }}</div>
          <div *ngIf="s3Error" class="text-sm text-red-600">{{ s3Error }}</div>

          <div class="flex items-center justify-between">
            <button
              *ngIf="s3Settings?.hasSecretKey"
              type="button"
              (click)="clearS3Secret()"
              [disabled]="isSavingS3"
              class="text-xs font-semibold uppercase tracking-wide text-rose-600 hover:text-rose-800 disabled:opacity-40"
            >
              Disconnect S3 secret
            </button>
            <span *ngIf="!s3Settings?.hasSecretKey"></span>
            <button
              type="submit"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-50"
              [disabled]="isSavingS3"
            >
              {{ isSavingS3 ? 'Saving…' : 'Save S3 settings' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class SettingsComponent implements OnInit {
  form: FormGroup;
  githubForm: FormGroup;
  incomeCategories: CategoryItem[] = [];
  isSaving = false;
  error = '';
  message = '';

  // GitHub
  githubSettings: GithubSettings | null = null;
  isSavingGithub = false;
  githubMessage = '';
  githubError = '';

  // S3
  s3Form: FormGroup;
  s3Settings: S3Settings | null = null;
  isSavingS3 = false;
  s3Message = '';
  s3Error = '';

  constructor(
    private readonly fb: FormBuilder,
    private readonly settingsApi: SettingsApiService,
    private readonly categoriesApi: CategoriesApiService,
  ) {
    this.form = this.fb.group({
      defaultPaymentCategoryId: ['', [Validators.required]],
      fxUsdToNio: [36, [Validators.required, Validators.min(0.0001)]],
    });
    this.githubForm = this.fb.group({
      org: [''],
      token: [''],
      autoCreate: [false],
      defaultPrivate: [true],
    });
    this.s3Form = this.fb.group({
      bucket: [''],
      region: [''],
      accessKeyId: [''],
      secretAccessKey: [''],
      endpoint: [''],
    });
  }

  ngOnInit() {
    this.loadCategories();
    this.loadSettings();
    this.loadGithub();
    this.loadS3();
  }

  loadS3() {
    this.settingsApi.getS3().subscribe({
      next: (data) => {
        this.s3Settings = data;
        this.s3Form.patchValue({
          bucket: data.bucket,
          region: data.region,
          accessKeyId: data.accessKeyId,
          secretAccessKey: '',
          endpoint: data.endpoint,
        });
      },
    });
  }

  saveS3() {
    this.isSavingS3 = true;
    this.s3Message = '';
    this.s3Error = '';
    const v = this.s3Form.value as {
      bucket: string;
      region: string;
      accessKeyId: string;
      secretAccessKey: string;
      endpoint: string;
    };
    const payload: UpdateS3SettingsPayload = {
      bucket: v.bucket ?? '',
      region: v.region ?? '',
      accessKeyId: v.accessKeyId ?? '',
      endpoint: v.endpoint ?? '',
    };
    if (v.secretAccessKey && v.secretAccessKey.trim().length > 0) {
      payload.secretAccessKey = v.secretAccessKey.trim();
    }
    this.settingsApi.updateS3(payload).subscribe({
      next: (data) => {
        this.s3Settings = data;
        this.s3Form.patchValue({ secretAccessKey: '' });
        this.isSavingS3 = false;
        this.s3Message = 'S3 settings saved';
        setTimeout(() => (this.s3Message = ''), 2500);
      },
      error: (err) => {
        this.isSavingS3 = false;
        this.s3Error = err?.error?.message ?? 'Unable to save S3 settings';
      },
    });
  }

  clearS3Secret() {
    this.isSavingS3 = true;
    this.settingsApi.updateS3({ secretAccessKey: null }).subscribe({
      next: (data) => {
        this.s3Settings = data;
        this.isSavingS3 = false;
        this.s3Message = 'S3 secret disconnected';
        setTimeout(() => (this.s3Message = ''), 2500);
      },
      error: () => {
        this.isSavingS3 = false;
        this.s3Error = 'Unable to disconnect S3 secret';
      },
    });
  }

  loadGithub() {
    this.settingsApi.getGithub().subscribe({
      next: (data) => {
        this.githubSettings = data;
        this.githubForm.patchValue({
          org: data.org,
          token: '',
          autoCreate: data.autoCreate,
          defaultPrivate: data.defaultPrivate,
        });
      },
    });
  }

  saveGithub() {
    this.isSavingGithub = true;
    this.githubMessage = '';
    this.githubError = '';
    const v = this.githubForm.value as {
      org: string;
      token: string;
      autoCreate: boolean;
      defaultPrivate: boolean;
    };
    const payload: UpdateGithubSettingsPayload = {
      org: v.org ?? '',
      autoCreate: !!v.autoCreate,
      defaultPrivate: !!v.defaultPrivate,
    };
    if (v.token && v.token.trim().length > 0) {
      payload.token = v.token.trim();
    }
    this.settingsApi.updateGithub(payload).subscribe({
      next: (data) => {
        this.githubSettings = data;
        this.githubForm.patchValue({ token: '' });
        this.isSavingGithub = false;
        this.githubMessage = 'GitHub settings saved';
        setTimeout(() => (this.githubMessage = ''), 2500);
      },
      error: (err) => {
        this.isSavingGithub = false;
        this.githubError = err?.error?.message ?? 'Unable to save GitHub settings';
      },
    });
  }

  clearGithubToken() {
    this.isSavingGithub = true;
    this.settingsApi.updateGithub({ token: null }).subscribe({
      next: (data) => {
        this.githubSettings = data;
        this.isSavingGithub = false;
        this.githubMessage = 'GitHub token disconnected';
        setTimeout(() => (this.githubMessage = ''), 2500);
      },
      error: () => {
        this.isSavingGithub = false;
        this.githubError = 'Unable to disconnect token';
      },
    });
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
