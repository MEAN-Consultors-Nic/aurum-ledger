import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../core/services/confirm.service';
import {
  DiagnoseResult,
  IssueSeverity,
  ReconcileApiService,
  ReconcileIssue,
} from '../../core/services/reconcile-api.service';

@Component({
  selector: 'app-reconcile',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <!-- HERO -->
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-slate-900">Reconcile</div>
          <div class="mt-1 text-sm text-slate-500">
            Data health check — finds inconsistencies between accounts, payments, contracts and occurrences. Run a scan and fix issues with one click.
          </div>
        </div>
        <button
          (click)="runDiagnose()"
          [disabled]="isLoading"
          class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
        >
          {{ isLoading ? 'Scanning…' : 'Run scan' }}
        </button>
      </header>

      <!-- STATUS BANNER -->
      <div *ngIf="result && result.issues.length === 0"
        class="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
        <div class="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700">✓</div>
        <div>
          <div class="text-sm font-semibold text-emerald-900">All clear</div>
          <div class="text-xs text-emerald-800">
            No data inconsistencies detected. Last scan: {{ formatDateTime(result.generatedAt) }}.
          </div>
        </div>
      </div>

      <div *ngIf="result && result.issues.length > 0"
        class="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
        <div class="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-700">!</div>
        <div class="flex-1">
          <div class="text-sm font-semibold text-amber-900">
            {{ result.issues.length }} issue{{ result.issues.length === 1 ? '' : 's' }} found
          </div>
          <div class="text-xs text-amber-800">
            Review each one below. Fixes are safe — soft-delete instead of hard-delete where possible.
          </div>
        </div>
      </div>

      <div *ngIf="!result && !isLoading"
        class="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
        Click <span class="font-semibold text-slate-700">Run scan</span> to check for data inconsistencies.
      </div>

      <!-- ISSUES -->
      <section *ngFor="let issue of result?.issues || []"
        class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                [ngClass]="severityBadge(issue.severity)">
                {{ issue.severity }}
              </span>
              <span class="text-sm font-semibold text-slate-900">{{ issue.title }}</span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                {{ issue.count }} affected
              </span>
            </div>
            <div class="mt-1 text-xs text-slate-600">{{ issue.description }}</div>
            <div *ngIf="hasAmounts(issue)" class="mt-1 text-xs text-slate-500">
              <span *ngIf="(issue.affectedAmountUsd ?? 0) !== 0">
                Net affected: <span class="font-semibold text-slate-900">USD {{ formatAmount(issue.affectedAmountUsd) }}</span>
              </span>
              <span *ngIf="(issue.affectedAmountNio ?? 0) !== 0" class="ml-3">
                <span class="font-semibold text-slate-900">NIO {{ formatAmount(issue.affectedAmountNio) }}</span>
              </span>
            </div>
          </div>
          <button
            (click)="fix(issue)"
            [disabled]="fixingKey === issue.key"
            class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
          >
            {{ fixingKey === issue.key ? 'Fixing…' : 'Fix' }}
          </button>
        </header>

        <div class="px-5 py-3 text-xs text-slate-600">
          <strong class="text-slate-700">Fix:</strong> {{ issue.fixDescription }}
        </div>

        <div *ngIf="issue.preview.length > 0" class="border-t border-slate-100 px-5 py-3">
          <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Preview ({{ issue.preview.length }} of {{ issue.count }})
          </div>
          <ul class="mt-2 space-y-1.5">
            <li *ngFor="let row of issue.preview" class="rounded-md bg-slate-50 px-3 py-2 font-mono text-[11px] text-slate-700">
              {{ stringifyPreview(row) }}
            </li>
          </ul>
        </div>
      </section>

      <!-- RESULT LOG -->
      <div *ngIf="lastFixResult" class="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
        <div class="font-semibold text-emerald-900">
          ✓ Fixed {{ lastFixResult.fixed }} record{{ lastFixResult.fixed === 1 ? '' : 's' }} ({{ lastFixResult.label }}).
        </div>
        <div class="text-xs text-emerald-800">Rescanning to verify…</div>
      </div>

      <div *ngIf="lastFixError" class="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {{ lastFixError }}
      </div>
    </div>
  `,
})
export class ReconcileComponent implements OnInit {
  result: DiagnoseResult | null = null;
  isLoading = false;
  fixingKey: string | null = null;
  lastFixResult: { fixed: number; label: string } | null = null;
  lastFixError = '';

  constructor(
    private readonly api: ReconcileApiService,
    private readonly confirmDialog: ConfirmService,
  ) {}

  ngOnInit() {
    this.runDiagnose();
  }

  runDiagnose() {
    this.isLoading = true;
    this.lastFixError = '';
    this.api.diagnose().subscribe({
      next: (r) => {
        this.result = r;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.lastFixError = err?.error?.message ?? 'Unable to scan';
      },
    });
  }

  async fix(issue: ReconcileIssue) {
    const ok = await this.confirmDialog.open({
      title: `Fix ${issue.title.toLowerCase()}?`,
      message: `${issue.count} record${issue.count === 1 ? '' : 's'} will be processed. ${issue.fixDescription}`,
      confirmText: 'Fix now',
      danger: issue.severity === 'critical',
    });
    if (!ok) return;
    this.fixingKey = issue.key;
    this.lastFixResult = null;
    this.lastFixError = '';
    this.api.fix(issue.key).subscribe({
      next: (res) => {
        this.fixingKey = null;
        this.lastFixResult = { fixed: res.fixed, label: issue.title };
        this.runDiagnose();
      },
      error: (err) => {
        this.fixingKey = null;
        this.lastFixError = err?.error?.message ?? 'Unable to fix';
      },
    });
  }

  severityBadge(s: IssueSeverity) {
    if (s === 'critical') return 'bg-rose-50 text-rose-700';
    if (s === 'warning') return 'bg-amber-50 text-amber-700';
    return 'bg-sky-50 text-sky-700';
  }

  hasAmounts(issue: ReconcileIssue) {
    return (issue.affectedAmountUsd ?? 0) !== 0 || (issue.affectedAmountNio ?? 0) !== 0;
  }

  formatAmount(value: number | undefined): string {
    return Number(value ?? 0).toFixed(2);
  }

  formatDateTime(s?: string) {
    if (!s) return '';
    return new Date(s).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  stringifyPreview(row: Record<string, unknown>): string {
    return Object.entries(row)
      .filter(([k]) => k !== '_id' && k !== '__v')
      .map(([k, v]) => `${k}: ${this.formatPreviewValue(v)}`)
      .join(' · ');
  }

  private formatPreviewValue(v: unknown): string {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) {
      return new Date(v).toLocaleDateString('en-US');
    }
    return String(v);
  }
}
