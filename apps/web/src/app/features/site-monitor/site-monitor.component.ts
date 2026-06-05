import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../../core/services/confirm.service';
import {
  CreateSiteMonitorPayload,
  SiteMonitorApiService,
} from '../../core/services/site-monitor-api.service';
import { SiteMonitorItem } from '../../core/models/site-monitor.model';

type Draft = {
  _id?: string;
  name: string;
  url: string;
  isActive: boolean;
  domainExpiresAt: string;
  sslWarnDays: number;
  domainWarnDays: number;
};

@Component({
  selector: 'app-site-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <!-- HERO -->
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-slate-900">Site monitor</div>
          <div class="mt-1 text-sm text-slate-500">
            Uptime, SSL expiry and domain expiry for sites you host or manage. HTTP probes run every 5 minutes; SSL refreshes once per day.
          </div>
        </div>
        <button
          (click)="openCreate()"
          class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white"
        >
          + Add monitor
        </button>
      </header>

      <!-- KPI strip -->
      <section class="grid gap-3 sm:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Monitors</div>
          <div class="mt-1 text-2xl font-semibold text-slate-900">{{ monitors.length }}</div>
        </div>
        <div class="rounded-xl border p-4 shadow-sm"
          [ngClass]="counts.down > 0 ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-white'">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Currently down</div>
          <div class="mt-1 text-2xl font-semibold"
            [ngClass]="counts.down > 0 ? 'text-rose-700' : 'text-slate-400'">
            {{ counts.down }}
          </div>
        </div>
        <div class="rounded-xl border p-4 shadow-sm"
          [ngClass]="counts.sslWarn > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">SSL expiring soon</div>
          <div class="mt-1 text-2xl font-semibold"
            [ngClass]="counts.sslWarn > 0 ? 'text-amber-700' : 'text-slate-400'">
            {{ counts.sslWarn }}
          </div>
        </div>
        <div class="rounded-xl border p-4 shadow-sm"
          [ngClass]="counts.domainWarn > 0 ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Domain expiring soon</div>
          <div class="mt-1 text-2xl font-semibold"
            [ngClass]="counts.domainWarn > 0 ? 'text-amber-700' : 'text-slate-400'">
            {{ counts.domainWarn }}
          </div>
        </div>
      </section>

      <!-- List -->
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div *ngIf="isLoading" class="px-5 py-8 text-center text-sm text-slate-500">Loading…</div>

        <div *ngIf="!isLoading && monitors.length === 0"
          class="px-5 py-12 text-center">
          <div class="text-sm font-semibold text-slate-700">No monitors yet</div>
          <div class="mt-1 text-xs text-slate-500">
            Add the first site you want to keep an eye on — usually the production URL of a hosting client.
          </div>
        </div>

        <ul *ngIf="!isLoading && monitors.length > 0" class="divide-y divide-slate-100">
          <li *ngFor="let m of monitors" class="flex flex-wrap items-start gap-4 px-5 py-4 hover:bg-slate-50">
            <!-- Status dot -->
            <span class="mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              [ngClass]="statusColor(m)"></span>

            <!-- Main -->
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <a [href]="m.url" target="_blank" rel="noopener"
                  class="text-sm font-semibold text-slate-900 hover:underline">{{ m.name }}</a>
                <span *ngIf="!m.isActive"
                  class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  Paused
                </span>
                <span *ngIf="projectName(m) as pname"
                  class="text-[11px] text-slate-500">· {{ pname }}</span>
              </div>
              <div class="mt-0.5 font-mono text-xs text-slate-500 truncate">{{ m.url }}</div>
              <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span class="rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide"
                  [ngClass]="m.isUp ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'">
                  {{ m.isUp ? 'Up' : 'Down' }}
                </span>
                <span *ngIf="m.lastHttpStatus !== undefined"
                  class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                  HTTP {{ m.lastHttpStatus }}
                </span>
                <span *ngIf="m.lastResponseMs !== undefined"
                  class="rounded bg-slate-100 px-1.5 py-0.5 text-slate-700">
                  {{ m.lastResponseMs }} ms
                </span>
                <span *ngIf="m.lastCheckedAt"
                  class="text-slate-500">
                  · checked {{ formatRelative(m.lastCheckedAt) }}
                </span>
              </div>
              <div *ngIf="!m.isUp && m.lastErrorMessage"
                class="mt-1 text-[11px] text-rose-600 truncate">{{ m.lastErrorMessage }}</div>
            </div>

            <!-- SSL & domain chips -->
            <div class="flex flex-col items-end gap-1 text-[11px]">
              <span class="rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide"
                [ngClass]="sslChip(m)">
                SSL · {{ sslLabel(m) }}
              </span>
              <span class="rounded-full px-2 py-0.5 font-semibold uppercase tracking-wide"
                [ngClass]="domainChip(m)">
                Domain · {{ domainLabel(m) }}
              </span>
            </div>

            <!-- Actions -->
            <div class="flex shrink-0 flex-col gap-1">
              <button (click)="checkNow(m)"
                [disabled]="busyIds.has(m._id)"
                class="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                {{ busyIds.has(m._id) ? 'Checking…' : 'Check now' }}
              </button>
              <button (click)="openEdit(m)"
                class="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50">
                Edit
              </button>
              <button (click)="remove(m)"
                class="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-100">
                Delete
              </button>
            </div>
          </li>
        </ul>
      </section>
    </div>

    <!-- Form modal -->
    <div *ngIf="isFormOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-base font-semibold text-slate-900">
            {{ draft._id ? 'Edit monitor' : 'New monitor' }}
          </div>
          <button (click)="closeForm()" class="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div class="mt-4 space-y-3">
          <div>
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Name</label>
            <input
              [(ngModel)]="draft.name"
              placeholder="e.g. EMClicks production"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">URL</label>
            <input
              [(ngModel)]="draft.url"
              placeholder="https://example.com"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm focus:border-slate-500 focus:outline-none"
            />
            <div class="mt-1 text-[11px] text-slate-500">
              Must include https:// for SSL monitoring.
            </div>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">SSL warn at (days)</label>
              <input
                [(ngModel)]="draft.sslWarnDays"
                type="number"
                min="1"
                class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Domain warn at (days)</label>
              <input
                [(ngModel)]="draft.domainWarnDays"
                type="number"
                min="1"
                class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Domain expiry (manual)</label>
            <input
              [(ngModel)]="draft.domainExpiresAt"
              type="date"
              class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
            />
            <div class="mt-1 text-[11px] text-slate-500">
              WHOIS isn't reliable across all TLDs (especially .ni), so the domain expiry is entered manually. Update it after every renewal.
            </div>
          </div>
          <label class="flex items-center gap-2">
            <input type="checkbox" [(ngModel)]="draft.isActive" />
            <span class="text-sm text-slate-700">Active (run checks)</span>
          </label>
          <div *ngIf="formError" class="text-xs text-rose-600">{{ formError }}</div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button (click)="closeForm()"
            class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Cancel
          </button>
          <button (click)="save()"
            [disabled]="isSaving || !canSave()"
            class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50">
            {{ isSaving ? 'Saving…' : (draft._id ? 'Save changes' : 'Create monitor') }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class SiteMonitorComponent implements OnInit {
  monitors: SiteMonitorItem[] = [];
  isLoading = false;
  busyIds = new Set<string>();

  // form
  isFormOpen = false;
  isSaving = false;
  formError = '';
  draft: Draft = this.blankDraft();

  constructor(
    private readonly api: SiteMonitorApiService,
    private readonly confirmDialog: ConfirmService,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.api.list().subscribe({
      next: (items) => {
        this.monitors = items;
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
    });
  }

  get counts() {
    const today = new Date();
    let down = 0;
    let sslWarn = 0;
    let domainWarn = 0;
    for (const m of this.monitors) {
      if (m.isActive && !m.isUp) down++;
      const sslDays = this.daysUntil(m.sslExpiresAt);
      if (sslDays !== null && sslDays <= m.sslWarnDays) sslWarn++;
      const domainDays = this.daysUntil(m.domainExpiresAt);
      if (domainDays !== null && domainDays <= m.domainWarnDays) domainWarn++;
    }
    return { down, sslWarn, domainWarn };
  }

  openCreate() {
    this.draft = this.blankDraft();
    this.formError = '';
    this.isFormOpen = true;
  }

  openEdit(m: SiteMonitorItem) {
    this.draft = {
      _id: m._id,
      name: m.name,
      url: m.url,
      isActive: m.isActive,
      domainExpiresAt: m.domainExpiresAt ? m.domainExpiresAt.slice(0, 10) : '',
      sslWarnDays: m.sslWarnDays ?? 30,
      domainWarnDays: m.domainWarnDays ?? 30,
    };
    this.formError = '';
    this.isFormOpen = true;
  }

  closeForm() {
    this.isFormOpen = false;
  }

  canSave(): boolean {
    return !!(this.draft.name.trim() && this.draft.url.trim());
  }

  save() {
    if (!this.canSave()) {
      this.formError = 'Name and URL are required';
      return;
    }
    const payload: CreateSiteMonitorPayload = {
      name: this.draft.name.trim(),
      url: this.draft.url.trim(),
      isActive: this.draft.isActive,
      sslWarnDays: Number(this.draft.sslWarnDays) || 30,
      domainWarnDays: Number(this.draft.domainWarnDays) || 30,
      domainExpiresAt: this.draft.domainExpiresAt || undefined,
    };
    this.isSaving = true;
    this.formError = '';
    const obs = this.draft._id
      ? this.api.update(this.draft._id, payload)
      : this.api.create(payload);
    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.isFormOpen = false;
        this.load();
      },
      error: (err) => {
        this.isSaving = false;
        this.formError = err?.error?.message ?? 'Unable to save monitor';
      },
    });
  }

  checkNow(m: SiteMonitorItem) {
    this.busyIds.add(m._id);
    this.api.checkNow(m._id).subscribe({
      next: (updated) => {
        const idx = this.monitors.findIndex((x) => x._id === m._id);
        if (idx !== -1) this.monitors[idx] = updated;
        this.busyIds.delete(m._id);
      },
      error: () => this.busyIds.delete(m._id),
    });
  }

  async remove(m: SiteMonitorItem) {
    const ok = await this.confirmDialog.open({
      title: 'Delete monitor',
      message: `Stop monitoring "${m.name}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(m._id).subscribe({
      next: () => (this.monitors = this.monitors.filter((x) => x._id !== m._id)),
    });
  }

  // ----- visual helpers -----

  projectName(m: SiteMonitorItem): string {
    if (!m.projectId) return '';
    if (typeof m.projectId === 'string') return '';
    return m.projectId.name ?? '';
  }

  statusColor(m: SiteMonitorItem): string {
    if (!m.isActive) return 'bg-slate-300';
    if (!m.isUp) return 'bg-rose-500';
    const sslDays = this.daysUntil(m.sslExpiresAt);
    const domainDays = this.daysUntil(m.domainExpiresAt);
    const sslWarn = sslDays !== null && sslDays <= m.sslWarnDays;
    const domainWarn = domainDays !== null && domainDays <= m.domainWarnDays;
    if (sslWarn || domainWarn) return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  sslLabel(m: SiteMonitorItem): string {
    const days = this.daysUntil(m.sslExpiresAt);
    if (days === null) return 'unknown';
    if (days < 0) return `expired ${Math.abs(days)}d ago`;
    if (days === 0) return 'expires today';
    return `${days}d left`;
  }

  sslChip(m: SiteMonitorItem): string {
    const days = this.daysUntil(m.sslExpiresAt);
    if (days === null) return 'bg-slate-100 text-slate-500';
    if (days < 0) return 'bg-rose-100 text-rose-700';
    if (days <= m.sslWarnDays) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-50 text-emerald-700';
  }

  domainLabel(m: SiteMonitorItem): string {
    const days = this.daysUntil(m.domainExpiresAt);
    if (days === null) return 'not set';
    if (days < 0) return `expired ${Math.abs(days)}d ago`;
    if (days === 0) return 'expires today';
    return `${days}d left`;
  }

  domainChip(m: SiteMonitorItem): string {
    const days = this.daysUntil(m.domainExpiresAt);
    if (days === null) return 'bg-slate-100 text-slate-500';
    if (days < 0) return 'bg-rose-100 text-rose-700';
    if (days <= m.domainWarnDays) return 'bg-amber-100 text-amber-700';
    return 'bg-emerald-50 text-emerald-700';
  }

  daysUntil(iso?: string): number | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  formatRelative(iso?: string): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  }

  private blankDraft(): Draft {
    return {
      name: '',
      url: 'https://',
      isActive: true,
      domainExpiresAt: '',
      sslWarnDays: 30,
      domainWarnDays: 30,
    };
  }
}
