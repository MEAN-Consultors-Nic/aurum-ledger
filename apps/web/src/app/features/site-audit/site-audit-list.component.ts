import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ClientsApiService } from '../../core/services/clients-api.service';
import { SiteAuditApiService } from '../../core/services/site-audit-api.service';
import { ClientItem } from '../../core/models/client.model';
import { SiteAudit, SiteAuditStatus } from '../../core/models/site-audit.model';

@Component({
  selector: 'app-site-audit-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="space-y-5">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Site audits</h1>
          <p class="mt-0.5 text-sm text-slate-500">
            Audit any website and turn the findings into a draft estimate.
          </p>
        </div>
        <button
          type="button"
          (click)="openModal()"
          class="rounded-md bg-navy-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-navy-800"
        >
          + New audit
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs">
        <button
          *ngFor="let s of statusFilters"
          type="button"
          (click)="filterStatus(s.value)"
          class="rounded-full border px-3 py-1 transition"
          [class.border-navy-600]="activeStatus() === s.value"
          [class.bg-navy-50]="activeStatus() === s.value"
          [class.text-navy-700]="activeStatus() === s.value"
          [class.border-slate-200]="activeStatus() !== s.value"
          [class.text-slate-600]="activeStatus() !== s.value"
        >{{ s.label }}</button>
      </div>

      <div *ngIf="loading()" class="text-sm text-slate-500">Loading…</div>

      <div *ngIf="!loading() && audits().length === 0" class="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p class="text-sm text-slate-500">No audits yet.</p>
        <button
          type="button"
          (click)="openModal()"
          class="mt-3 text-sm font-medium text-navy-700 hover:underline"
        >Start your first audit →</button>
      </div>

      <div *ngIf="!loading() && audits().length > 0" class="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table class="w-full text-sm">
          <thead class="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-2.5">Site</th>
              <th class="px-4 py-2.5">Partner</th>
              <th class="px-4 py-2.5">Status</th>
              <th class="px-4 py-2.5 text-center">Mobile</th>
              <th class="px-4 py-2.5 text-center">Desktop</th>
              <th class="px-4 py-2.5">Created</th>
            </tr>
          </thead>
          <tbody>
            <tr
              *ngFor="let a of audits()"
              class="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
              [routerLink]="['/audits', a._id]"
            >
              <td class="px-4 py-3">
                <div class="font-medium text-slate-900">{{ hostnameOf(a) }}</div>
                <div class="truncate text-[11px] text-slate-400">{{ a.normalizedUrl }}</div>
              </td>
              <td class="px-4 py-3 text-slate-700">{{ a.partnerName || '—' }}</td>
              <td class="px-4 py-3"><span [class]="statusClass(a.status)">{{ a.status }}</span></td>
              <td class="px-4 py-3 text-center">
                <span *ngIf="a.findings.pageSpeed?.mobile?.performance !== undefined" [class]="scoreClass(a.findings.pageSpeed?.mobile?.performance)">{{ a.findings.pageSpeed?.mobile?.performance }}</span>
                <span *ngIf="a.findings.pageSpeed?.mobile?.performance === undefined" class="text-slate-300">—</span>
              </td>
              <td class="px-4 py-3 text-center">
                <span *ngIf="a.findings.pageSpeed?.desktop?.performance !== undefined" [class]="scoreClass(a.findings.pageSpeed?.desktop?.performance)">{{ a.findings.pageSpeed?.desktop?.performance }}</span>
                <span *ngIf="a.findings.pageSpeed?.desktop?.performance === undefined" class="text-slate-300">—</span>
              </td>
              <td class="px-4 py-3 text-[11px] text-slate-400">{{ formatDate(a.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- New audit modal -->
      <div *ngIf="modalOpen()" class="fixed inset-0 z-40 bg-slate-900/30" (click)="closeModal()"></div>
      <div *ngIf="modalOpen()" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
        <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
          <header class="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 class="text-base font-semibold text-slate-900">New site audit</h2>
            <button type="button" (click)="closeModal()" class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>
          <form class="space-y-3 px-5 py-4" (ngSubmit)="submit()">
            <div>
              <label class="text-[11px] font-medium text-slate-600">Website URL *</label>
              <input
                type="text"
                [(ngModel)]="form.url"
                name="url"
                required
                placeholder="https://example.com"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              />
            </div>
            <div>
              <label class="text-[11px] font-medium text-slate-600">Partner</label>
              <input
                type="text"
                [(ngModel)]="form.partnerName"
                name="partnerName"
                placeholder="Who sent this to you?"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              />
            </div>
            <div>
              <label class="text-[11px] font-medium text-slate-600">Client</label>
              <select
                [(ngModel)]="form.clientId"
                name="clientId"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              >
                <option value="">— None / will fill later —</option>
                <option *ngFor="let c of clients()" [value]="c._id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-[11px] font-medium text-slate-600">Notes</label>
              <textarea
                [(ngModel)]="form.notes"
                name="notes"
                rows="2"
                placeholder="Context, link to brief, etc."
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              ></textarea>
            </div>

            <div *ngIf="error()" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{{ error() }}</div>

            <p class="text-[11px] text-slate-400">
              We'll fetch the homepage, run PageSpeed Insights, parse the sitemap, and (if OpenAI is configured) generate an executive summary plus suggested line items. Usually finishes in 60–90 seconds.
            </p>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button type="button" (click)="closeModal()" class="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                type="submit"
                [disabled]="saving()"
                class="rounded-md bg-navy-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:bg-slate-300"
              >{{ saving() ? 'Starting…' : 'Start audit' }}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
})
export class SiteAuditListComponent implements OnInit {
  readonly statusFilters: { value: SiteAuditStatus | ''; label: string }[] = [
    { value: '', label: 'All' },
    { value: 'running', label: 'Running' },
    { value: 'completed', label: 'Completed' },
    { value: 'failed', label: 'Failed' },
  ];

  audits = signal<SiteAudit[]>([]);
  clients = signal<ClientItem[]>([]);
  loading = signal(true);
  activeStatus = signal<SiteAuditStatus | ''>('');
  modalOpen = signal(false);
  saving = signal(false);
  error = signal('');

  form: { url: string; partnerName: string; clientId: string; notes: string } = {
    url: '',
    partnerName: '',
    clientId: '',
    notes: '',
  };

  constructor(
    private readonly api: SiteAuditApiService,
    private readonly clientsApi: ClientsApiService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.refresh();
    this.clientsApi.list({ limit: 200, isActive: true }).subscribe({
      next: (res) => this.clients.set(res.items ?? []),
    });
  }

  refresh() {
    this.loading.set(true);
    const status = this.activeStatus();
    this.api.list({ status: status || undefined }).subscribe({
      next: (rows) => {
        this.audits.set(rows);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  filterStatus(s: SiteAuditStatus | '') {
    this.activeStatus.set(s);
    this.refresh();
  }

  openModal() {
    this.form = { url: '', partnerName: '', clientId: '', notes: '' };
    this.error.set('');
    this.modalOpen.set(true);
  }

  closeModal() {
    this.modalOpen.set(false);
  }

  submit() {
    if (!this.form.url.trim()) {
      this.error.set('URL is required');
      return;
    }
    this.saving.set(true);
    this.api
      .create({
        url: this.form.url.trim(),
        partnerName: this.form.partnerName || undefined,
        clientId: this.form.clientId || undefined,
        notes: this.form.notes || undefined,
      })
      .subscribe({
        next: (a) => {
          this.saving.set(false);
          this.modalOpen.set(false);
          this.router.navigate(['/audits', a._id]);
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? 'Could not start audit');
        },
      });
  }

  hostnameOf(a: SiteAudit) {
    try {
      return new URL(a.normalizedUrl).hostname.replace(/^www\./, '');
    } catch {
      return a.url;
    }
  }

  statusClass(s: SiteAuditStatus) {
    const base = 'rounded-full px-2 py-0.5 text-[11px] font-medium';
    switch (s) {
      case 'running':
        return `${base} bg-sky-50 text-sky-700`;
      case 'completed':
        return `${base} bg-emerald-50 text-emerald-700`;
      case 'failed':
        return `${base} bg-rose-50 text-rose-700`;
      default:
        return `${base} bg-slate-100 text-slate-600`;
    }
  }

  scoreClass(score: number | undefined) {
    const base = 'inline-flex h-6 w-9 items-center justify-center rounded-md text-xs font-semibold';
    if (score === undefined) return `${base} bg-slate-100 text-slate-400`;
    if (score >= 90) return `${base} bg-emerald-50 text-emerald-700`;
    if (score >= 50) return `${base} bg-amber-50 text-amber-700`;
    return `${base} bg-rose-50 text-rose-700`;
  }

  formatDate(iso?: string) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString();
  }
}
