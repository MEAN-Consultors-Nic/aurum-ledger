import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EstimateShareStatus } from '../../core/models/estimate.model';
import { EstimatesApiService } from '../../core/services/estimates-api.service';

/** What the dialog needs to know about the estimate. */
export type EstimateShareTarget = {
  id: string;
  title?: string;
  clientName?: string;
};

/**
 * "Share by link": a client link protected by a 6-digit PIN.
 * Helm shows the PIN once, right after creating the link, and keeps only its
 * hash — a lost PIN means creating a new link. The link and the PIN are
 * copied as two separate messages so they can travel by different channels.
 */
@Component({
  selector: 'app-estimate-share-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="open && target" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div class="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-lg font-semibold">Share by link</div>
            <div class="text-xs text-slate-500">{{ target.clientName || 'Client' }} · {{ target.title || 'Estimate' }}</div>
          </div>
          <button class="text-slate-400" (click)="close()">X</button>
        </div>

        <div *ngIf="loading" class="mt-6 text-sm text-slate-500">Loading…</div>
        <div *ngIf="error" class="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error }}</div>

        <ng-container *ngIf="!loading && share">
          <!-- Client answer -->
          <div *ngIf="share.clientDecision" class="mt-5 rounded-lg border px-4 py-3 text-sm"
            [ngClass]="share.clientDecision === 'accepted' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'">
            <div class="font-semibold">
              {{ share.clientDecision === 'accepted' ? 'Accepted by the client' : 'Declined by the client' }}
              <span class="font-normal">· {{ formatDate(share.clientDecisionAt) }}</span>
            </div>
            <div *ngIf="share.clientDecisionName">Signed as <strong>{{ share.clientDecisionName }}</strong></div>
            <div *ngIf="share.clientDecisionReason">Reason: <em>{{ share.clientDecisionReason }}</em></div>
            <div *ngIf="share.clientDecisionSnapshot" class="text-xs opacity-80">
              For {{ share.clientDecisionSnapshot.currency }} {{ share.clientDecisionSnapshot.amount | number: '1.2-2' }}
              <span *ngIf="share.clientDecisionIp">· IP {{ share.clientDecisionIp }}</span>
            </div>
          </div>

          <!-- No link yet -->
          <div *ngIf="!share.shareToken" class="mt-5 text-sm text-slate-600">
            Create a private link to this proposal. Your client opens it with a 6-digit PIN and can accept
            (signing with their name) or decline it. You will see the PIN only once.
          </div>

          <!-- Link -->
          <div *ngIf="share.shareToken" class="mt-5 space-y-4">
            <div class="flex items-center gap-2">
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider" [ngClass]="stateBadge()">{{ stateLabel() }}</span>
              <span class="text-xs text-slate-500">
                {{ share.shareViewCount }} view{{ share.shareViewCount === 1 ? '' : 's' }}
                <ng-container *ngIf="share.shareLastViewedAt"> · last {{ formatDate(share.shareLastViewedAt) }}</ng-container>
                <ng-container *ngIf="share.shareFailedAttempts && !share.shareLockedAt"> · {{ share.shareFailedAttempts }} wrong PIN{{ share.shareFailedAttempts === 1 ? '' : 's' }}</ng-container>
                <ng-container *ngIf="share.expiresAt"> · valid until {{ formatDay(share.expiresAt) }}</ng-container>
              </span>
            </div>

            <div>
              <label class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Link</label>
              <div class="mt-1 flex items-center gap-2">
                <input type="text" [value]="url()" readonly
                  class="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-700 focus:outline-none" />
                <button type="button" (click)="copy(url(), 'link')" [disabled]="!usable()"
                  class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-40">
                  {{ copied === 'link' ? 'Copied' : 'Copy' }}
                </button>
              </div>
            </div>

            <!-- PIN: only right after creating the link -->
            <div *ngIf="pin" class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
              <label class="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-800">PIN — shown only now</label>
              <div class="mt-1 flex items-center gap-3">
                <div class="font-mono text-3xl font-bold tracking-[0.35em] text-slate-900">{{ pin }}</div>
                <button type="button" (click)="copy(pin, 'pin')"
                  class="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
                  {{ copied === 'pin' ? 'Copied' : 'Copy PIN' }}
                </button>
              </div>
              <div class="mt-2 text-xs text-amber-900">
                Helm does not keep it. Send it through a different channel than the link (e.g. link by email, PIN by WhatsApp).
                If it gets lost, create a new link.
              </div>
            </div>
            <div *ngIf="!pin && usable()" class="text-xs text-slate-500">
              The PIN was shown when the link was created. If your client lost it, create a new link (the current one stops working).
            </div>

            <!-- Ready-made messages -->
            <div *ngIf="usable()" class="rounded-lg bg-slate-50 px-3 py-3">
              <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Messages for your client</div>
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" (click)="copy(linkMessage('es'), 'msg-link-es')" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                  {{ copied === 'msg-link-es' ? 'Copied' : 'Link message (ES)' }}
                </button>
                <button type="button" (click)="copy(linkMessage('en'), 'msg-link-en')" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                  {{ copied === 'msg-link-en' ? 'Copied' : 'Link message (EN)' }}
                </button>
                <ng-container *ngIf="pin">
                  <button type="button" (click)="copy(pinMessage('es'), 'msg-pin-es')" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                    {{ copied === 'msg-pin-es' ? 'Copied' : 'PIN message (ES)' }}
                  </button>
                  <button type="button" (click)="copy(pinMessage('en'), 'msg-pin-en')" class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700">
                    {{ copied === 'msg-pin-en' ? 'Copied' : 'PIN message (EN)' }}
                  </button>
                </ng-container>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div class="mt-6 flex flex-wrap items-center justify-end gap-2">
            <button *ngIf="usable() && !confirmingRevoke" type="button" (click)="confirmingRevoke = true" [disabled]="busy"
              class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-700 disabled:opacity-40">
              Revoke link
            </button>
            <ng-container *ngIf="confirmingRevoke">
              <span class="text-xs text-rose-700">The client will no longer be able to open it.</span>
              <button type="button" (click)="confirmingRevoke = false" class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">Cancel</button>
              <button type="button" (click)="revoke()" [disabled]="busy" class="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40">Revoke</button>
            </ng-container>

            <ng-container *ngIf="canCreate() && !confirmingRevoke">
              <ng-container *ngIf="share.shareToken && usable() && !confirmingRegenerate">
                <button type="button" (click)="confirmingRegenerate = true" [disabled]="busy"
                  class="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-40">
                  New link + PIN
                </button>
              </ng-container>
              <ng-container *ngIf="confirmingRegenerate">
                <span class="text-xs text-slate-600">The current link and PIN stop working.</span>
                <button type="button" (click)="confirmingRegenerate = false" class="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">Cancel</button>
              </ng-container>
              <button *ngIf="!share.shareToken || !usable() || confirmingRegenerate" type="button" (click)="generate()" [disabled]="busy"
                class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40">
                {{ busy ? 'Creating…' : share.shareToken ? 'Create new link + PIN' : 'Create link + PIN' }}
              </button>
            </ng-container>
            <div *ngIf="!canCreate() && !share.shareToken" class="text-xs text-slate-500">
              Only draft or sent estimates can be shared.
            </div>
          </div>
        </ng-container>
      </div>
    </div>
  `,
})
export class EstimateShareDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() target: EstimateShareTarget | null = null;
  /** Emitted on close; `changed` when a link was created or revoked (status may have moved to sent). */
  @Output() closed = new EventEmitter<{ changed: boolean }>();

  share: EstimateShareStatus | null = null;
  pin = '';
  loading = false;
  busy = false;
  error = '';
  copied = '';
  confirmingRevoke = false;
  confirmingRegenerate = false;
  private changed = false;
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly estimatesApi: EstimatesApiService) {}

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['open'] || changes['target']) && this.open && this.target) {
      this.reset();
      this.load();
    }
  }

  private reset() {
    this.share = null;
    this.pin = '';
    this.error = '';
    this.copied = '';
    this.confirmingRevoke = false;
    this.confirmingRegenerate = false;
    this.changed = false;
  }

  private load() {
    if (!this.target) return;
    this.loading = true;
    this.estimatesApi.getShare(this.target.id).subscribe({
      next: (s) => {
        this.share = s;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Unable to load the link';
        this.loading = false;
      },
    });
  }

  generate() {
    if (!this.target) return;
    this.busy = true;
    this.error = '';
    this.estimatesApi.generateShare(this.target.id).subscribe({
      next: (s) => {
        this.pin = s.pin ?? '';
        this.share = { ...s, pin: undefined };
        this.busy = false;
        this.confirmingRegenerate = false;
        this.changed = true;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Unable to create the link';
        this.busy = false;
      },
    });
  }

  revoke() {
    if (!this.target) return;
    this.busy = true;
    this.estimatesApi.revokeShare(this.target.id).subscribe({
      next: () => {
        this.busy = false;
        this.confirmingRevoke = false;
        this.pin = '';
        this.changed = true;
        this.load();
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Unable to revoke the link';
        this.busy = false;
      },
    });
  }

  close() {
    this.pin = '';
    this.closed.emit({ changed: this.changed });
  }

  /** The link still opens for the client (open, or read-only after an answer). */
  usable(): boolean {
    const s = this.share?.linkState;
    return !!this.share?.shareToken && !!this.share?.hasPin && (s === 'open' || s === 'responded' || s === 'closed');
  }

  canCreate(): boolean {
    return this.share?.status === 'draft' || this.share?.status === 'sent';
  }

  url(): string {
    if (!this.share?.shareToken) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/portal/estimates/${this.share.shareToken}`;
  }

  stateLabel(): string {
    if (this.share?.shareToken && !this.share.hasPin) return 'Old link (no PIN)';
    switch (this.share?.linkState) {
      case 'open': return 'Live';
      case 'responded': return this.share.clientDecision === 'accepted' ? 'Accepted' : 'Declined';
      case 'closed': return 'Read-only';
      case 'expired': return 'Expired';
      case 'locked': return 'Locked (wrong PINs)';
      case 'revoked': return 'Revoked';
      default: return '';
    }
  }

  stateBadge(): string {
    switch (this.share?.linkState) {
      case 'open': return 'bg-emerald-100 text-emerald-700';
      case 'responded': return this.share?.clientDecision === 'accepted' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700';
      case 'locked':
      case 'revoked': return 'bg-rose-100 text-rose-700';
      case 'expired': return 'bg-amber-100 text-amber-700';
      default: return 'bg-slate-100 text-slate-700';
    }
  }

  linkMessage(lang: 'es' | 'en'): string {
    const title = this.target?.title || (lang === 'es' ? 'la propuesta' : 'the proposal');
    return lang === 'es'
      ? `Hola, aquí está la propuesta "${title}" de MEAN Consultors:\n${this.url()}\n\nTe enviaré el PIN de acceso por separado. Con él puedes revisarla y aceptarla o rechazarla directamente en la página.`
      : `Hi, here is the proposal "${title}" from MEAN Consultors:\n${this.url()}\n\nI will send you the access PIN separately. With it you can review the proposal and accept or decline it on the page.`;
  }

  pinMessage(lang: 'es' | 'en'): string {
    return lang === 'es'
      ? `Tu PIN para abrir la propuesta de MEAN Consultors es: ${this.pin}\nTambién lo necesitarás para aceptarla.`
      : `Your PIN to open the MEAN Consultors proposal is: ${this.pin}\nYou will also need it to accept it.`;
  }

  copy(text: string, what: string) {
    if (!text) return;
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        this.copied = what;
        if (this.copyTimer) clearTimeout(this.copyTimer);
        this.copyTimer = setTimeout(() => (this.copied = ''), 2000);
      })
      .catch(() => (this.error = 'Could not copy to the clipboard'));
  }

  formatDate(value?: string | null): string {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  /** `expiresAt` is the instant after the last valid day ends (Managua): show that day. */
  formatDay(value?: string | null): string {
    if (!value) return '';
    const d = new Date(new Date(value).getTime() - 1);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Managua' });
  }
}
