import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

export type SharePanelState = {
  shareToken?: string;
  shareCreatedAt?: string;
  shareRevokedAt?: string;
  shareViewCount?: number;
  shareLastViewedAt?: string;
};

/**
 * Reusable client-portal share panel.
 * Consumer wires:
 *  - portalPath: e.g. '/portal/estimates' (no trailing slash, no token)
 *  - state: current share metadata
 *  - (generate) / (revoke) outputs to call the corresponding API
 */
@Component({
  selector: 'app-share-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header class="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <div class="text-sm font-semibold text-slate-900">Share with client</div>
          <div class="text-xs text-slate-500">
            Generates a public read-only link your client can open without an account.
          </div>
        </div>
        <span
          *ngIf="isActive()"
          class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700"
        >Live</span>
        <span
          *ngIf="isRevoked()"
          class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700"
        >Revoked</span>
      </header>

      <!-- No link yet -->
      <div *ngIf="!state?.shareToken" class="px-5 py-5">
        <div class="text-xs text-slate-500">
          No share link generated yet. Generate one to give your client a clean, branded view.
        </div>
        <button
          type="button"
          (click)="emitGenerate()"
          [disabled]="busy"
          class="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
        >
          {{ busy ? 'Generating…' : 'Generate share link' }}
        </button>
      </div>

      <!-- Active or revoked link -->
      <div *ngIf="state?.shareToken" class="space-y-3 px-5 py-4">
        <div>
          <label class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Link</label>
          <div class="mt-1 flex items-center gap-2">
            <input
              type="text"
              [value]="fullUrl()"
              readonly
              class="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 focus:outline-none"
            />
            <button
              type="button"
              (click)="copyLink()"
              [disabled]="isRevoked()"
              class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              {{ copyLabel }}
            </button>
            <a
              [href]="fullUrl()"
              target="_blank"
              rel="noopener"
              class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
              [class.pointer-events-none]="isRevoked()"
              [class.opacity-40]="isRevoked()"
            >Open</a>
          </div>
        </div>

        <!-- Stats -->
        <div class="grid grid-cols-3 gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-xs">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Created</div>
            <div class="mt-0.5 text-slate-800">{{ formatDate(state?.shareCreatedAt) }}</div>
          </div>
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Views</div>
            <div class="mt-0.5 text-slate-800">{{ state?.shareViewCount ?? 0 }}</div>
          </div>
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Last viewed</div>
            <div class="mt-0.5 text-slate-800">{{ formatDate(state?.shareLastViewedAt) || 'Never' }}</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            (click)="emitGenerate()"
            [disabled]="busy"
            class="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {{ isRevoked() ? 'Generate new link' : 'Regenerate (invalidates current)' }}
          </button>
          <button
            type="button"
            *ngIf="isActive()"
            (click)="emitRevoke()"
            [disabled]="busy"
            class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-100 disabled:opacity-40"
          >
            Revoke link
          </button>
        </div>
      </div>
    </section>
  `,
})
export class SharePanelComponent {
  @Input() portalPath = '';
  @Input() state: SharePanelState | null = null;
  @Input() busy = false;

  @Output() generate = new EventEmitter<void>();
  @Output() revoke = new EventEmitter<void>();

  copyLabel = 'Copy';
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  isActive(): boolean {
    return !!this.state?.shareToken && !this.state?.shareRevokedAt;
  }

  isRevoked(): boolean {
    return !!this.state?.shareToken && !!this.state?.shareRevokedAt;
  }

  fullUrl(): string {
    if (!this.state?.shareToken) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}${this.portalPath}/${this.state.shareToken}`;
  }

  emitGenerate() {
    this.generate.emit();
  }

  emitRevoke() {
    this.revoke.emit();
  }

  copyLink() {
    if (!this.state?.shareToken) return;
    const url = this.fullUrl();
    navigator.clipboard
      ?.writeText(url)
      .then(() => this.flashLabel('Copied'))
      .catch(() => this.flashLabel('Failed'));
  }

  private flashLabel(text: string) {
    this.copyLabel = text;
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      this.copyLabel = 'Copy';
      this.copyTimer = null;
    }, 2000);
  }

  formatDate(value?: string) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
