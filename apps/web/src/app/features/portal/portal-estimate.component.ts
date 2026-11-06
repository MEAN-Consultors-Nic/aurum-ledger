import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { PublicApiService, PublicEstimate } from '../../core/services/public-api.service';

type Step = 'loading' | 'closed' | 'pin' | 'proposal';

/**
 * Client view of a proposal shared "by link". The link alone shows nothing:
 * the client enters the 6-digit PIN they received separately, reads the
 * proposal and can accept it (full name as signature + accept the terms +
 * the PIN again) or decline it (optional reason + the PIN again).
 */
@Component({
  selector: 'app-portal-estimate',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <!-- Brand header -->
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div class="text-lg font-semibold tracking-tight">MEAN Consultors</div>
          <div class="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Client portal
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-4xl px-6 py-10">
        <!-- Loading -->
        <div *ngIf="step === 'loading'" class="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading proposal…
        </div>

        <!-- Link does not open -->
        <div *ngIf="step === 'closed'" class="rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
          <div class="text-base font-semibold text-rose-800">Link unavailable</div>
          <div class="mt-1 text-sm text-rose-700">{{ error }}</div>
          <div class="mt-4 text-xs text-rose-600">
            If you believe this is a mistake, please contact MEAN Consultors directly.
          </div>
        </div>

        <!-- PIN -->
        <form *ngIf="step === 'pin'" (ngSubmit)="unlock()"
          class="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-white px-8 py-8 text-center shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Private proposal</div>
          <h1 class="mt-2 text-xl font-semibold text-slate-900">Enter your PIN</h1>
          <p class="mt-1 text-sm text-slate-500">Use the 6-digit PIN MEAN Consultors sent you.</p>
          <input
            name="pin"
            [(ngModel)]="pin"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="••••••"
            aria-label="PIN"
            (input)="pin = digitsOnly(pin)"
            class="mt-5 w-full rounded-lg border border-slate-300 px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] focus:border-slate-900 focus:outline-none"
          />
          <div *ngIf="error" class="mt-3 text-sm text-rose-700">{{ error }}</div>
          <button type="submit" [disabled]="busy || pin.length !== 6"
            class="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40">
            {{ busy ? 'Checking…' : 'Open proposal' }}
          </button>
        </form>

        <!-- Proposal content -->
        <ng-container *ngIf="step === 'proposal' && estimate as e">
          <!-- Answer banner -->
          <div *ngIf="e.decision" class="mb-6 rounded-xl border px-6 py-4 text-sm"
            [ngClass]="e.decision.decision === 'accepted' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700'">
            <div class="font-semibold">
              {{ e.decision.decision === 'accepted' ? 'You accepted this proposal' : 'You declined this proposal' }}
            </div>
            <div class="text-xs">
              {{ formatDateTime(e.decision.at) }}<ng-container *ngIf="e.decision.name"> · signed as {{ e.decision.name }}</ng-container>.
              {{ e.decision.decision === 'accepted' ? 'MEAN Consultors has been notified and will contact you with the next steps.' : 'MEAN Consultors has been notified. Thank you for letting us know.' }}
            </div>
          </div>

          <article class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header class="border-b border-slate-100 px-8 py-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Proposal</div>
                  <h1 class="mt-1 text-2xl font-semibold text-slate-900">{{ e.title || 'Untitled proposal' }}</h1>
                  <div class="mt-1 text-sm text-slate-500">
                    Prepared for <span class="font-medium text-slate-700">{{ e.clientName || 'client' }}</span>
                  </div>
                </div>
                <span class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
                  [ngClass]="statusClass(e.status)">
                  {{ statusLabel(e.status) }}
                </span>
              </div>

              <dl class="mt-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Service</dt>
                  <dd class="mt-1 text-sm text-slate-800">{{ e.serviceName || '—' }}</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Billing</dt>
                  <dd class="mt-1 text-sm text-slate-800">{{ billingLabel(e.billingPeriod) }}</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Valid until</dt>
                  <dd class="mt-1 text-sm text-slate-800">{{ formatDate(e.validUntil) }}</dd>
                </div>
              </dl>
            </header>

            <!-- Amount block -->
            <section class="bg-slate-900 px-8 py-6 text-white">
              <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">Total</div>
              <div class="mt-1 text-3xl font-bold tracking-tight">
                {{ e.currency }} {{ formatNumber(e.amount) }}
              </div>
              <div class="text-xs text-slate-300">{{ billingLabel(e.billingPeriod) }}</div>
            </section>

            <!-- Scope -->
            <section *ngIf="e.scope" class="border-b border-slate-100 px-8 py-6">
              <h2 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Scope of work</h2>
              <div class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{{ e.scope }}</div>
            </section>

            <!-- Deliverables -->
            <section *ngIf="e.deliverables?.length" class="border-b border-slate-100 px-8 py-6">
              <h2 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Deliverables</h2>
              <ul class="mt-3 space-y-2">
                <li *ngFor="let d of e.deliverables" class="flex items-start gap-3 text-sm text-slate-700">
                  <span class="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900"></span>
                  <span>{{ d }}</span>
                </li>
              </ul>
            </section>

            <!-- Terms -->
            <section *ngIf="e.terms" class="px-8 py-6">
              <h2 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Terms &amp; conditions</h2>
              <div class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{{ e.terms }}</div>
            </section>

            <!-- Answer -->
            <section *ngIf="e.canRespond" class="border-t border-slate-100 px-8 py-6">
              <div class="flex flex-wrap items-center justify-end gap-3">
                <button type="button" (click)="openAnswer('decline')"
                  class="rounded-lg border border-slate-300 bg-white px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Decline
                </button>
                <button type="button" (click)="openAnswer('accept')"
                  class="rounded-lg bg-emerald-600 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-white">
                  Accept proposal
                </button>
              </div>
            </section>

            <footer class="rounded-b-2xl border-t border-slate-100 bg-slate-50 px-8 py-4 text-center text-xs text-slate-500">
              Questions? Reach out to your account contact at MEAN Consultors to confirm or adjust this proposal.
            </footer>
          </article>
        </ng-container>

        <div class="mt-6 text-center text-[10px] uppercase tracking-[0.25em] text-slate-400">
          MEAN Consultors · Nicaragua
        </div>
      </main>

      <!-- Accept / decline -->
      <div *ngIf="answering && estimate" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
        <form (ngSubmit)="submitAnswer()" class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div class="flex items-center justify-between">
            <div class="text-lg font-semibold">{{ answering === 'accept' ? 'Accept proposal' : 'Decline proposal' }}</div>
            <button type="button" class="text-slate-400" (click)="closeAnswer()">X</button>
          </div>

          <ng-container *ngIf="answering === 'accept'">
            <p class="mt-2 text-sm text-slate-600">
              You are accepting <strong>{{ estimate.title }}</strong> for
              <strong>{{ estimate.currency }} {{ formatNumber(estimate.amount) }}</strong> ({{ billingLabel(estimate.billingPeriod) | lowercase }}).
            </p>
            <label class="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="signName">Full name (your signature)</label>
            <input id="signName" name="signName" [(ngModel)]="signName" autocomplete="name" maxlength="120"
              class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none" />
            <label class="mt-4 flex items-start gap-2 text-sm text-slate-700">
              <input type="checkbox" name="acceptTerms" [(ngModel)]="acceptTerms" class="mt-0.5" />
              <span>I have read the proposal and accept its scope, price and terms &amp; conditions.</span>
            </label>
          </ng-container>

          <ng-container *ngIf="answering === 'decline'">
            <label class="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="reason">Reason (optional)</label>
            <textarea id="reason" name="reason" [(ngModel)]="reason" rows="3" maxlength="1000"
              class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"></textarea>
          </ng-container>

          <label class="mt-4 block text-xs font-semibold uppercase tracking-wide text-slate-500" for="confirmPin">Security PIN</label>
          <input id="confirmPin" name="confirmPin" [(ngModel)]="confirmPin" inputmode="numeric" autocomplete="off" maxlength="6"
            placeholder="••••••" (input)="confirmPin = digitsOnly(confirmPin)"
            class="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-xl tracking-[0.5em] focus:border-slate-900 focus:outline-none" />

          <div *ngIf="answerError" class="mt-3 text-sm text-rose-700">{{ answerError }}</div>

          <div class="mt-6 flex justify-end gap-2">
            <button type="button" (click)="closeAnswer()" class="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700">Cancel</button>
            <button type="submit" [disabled]="busy || !canSubmitAnswer()"
              class="rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40"
              [ngClass]="answering === 'accept' ? 'bg-emerald-600' : 'bg-slate-900'">
              {{ busy ? 'Sending…' : answering === 'accept' ? 'Accept and sign' : 'Decline proposal' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class PortalEstimateComponent implements OnInit {
  step: Step = 'loading';
  estimate: PublicEstimate | null = null;
  error = '';
  busy = false;
  pin = '';

  answering: 'accept' | 'decline' | null = null;
  signName = '';
  acceptTerms = false;
  reason = '';
  confirmPin = '';
  answerError = '';

  private token = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly publicApi: PublicApiService,
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!this.token) {
      this.close('This link is invalid.');
      return;
    }
    this.publicApi.getEstimateGate(this.token).subscribe({
      next: (g) => {
        if (g.requiresPin) this.step = 'pin';
        else this.close(g.message ?? 'This link is no longer valid.');
      },
      error: () => this.close('This link is no longer valid or has been revoked.'),
    });
  }

  unlock() {
    if (this.pin.length !== 6) return;
    this.busy = true;
    this.error = '';
    this.publicApi.unlockEstimate(this.token, this.pin).subscribe({
      next: (e) => {
        this.estimate = e;
        this.step = 'proposal';
        this.busy = false;
      },
      error: (err: HttpErrorResponse) => {
        this.busy = false;
        this.pin = '';
        this.handleError(err, (m) => (this.error = m));
      },
    });
  }

  openAnswer(kind: 'accept' | 'decline') {
    this.answering = kind;
    this.answerError = '';
    this.confirmPin = '';
  }

  closeAnswer() {
    this.answering = null;
    this.confirmPin = '';
  }

  canSubmitAnswer(): boolean {
    if (this.confirmPin.length !== 6) return false;
    if (this.answering === 'accept') return this.signName.trim().length >= 3 && this.acceptTerms;
    return true;
  }

  submitAnswer() {
    if (!this.answering || !this.canSubmitAnswer()) return;
    this.busy = true;
    this.answerError = '';
    const request =
      this.answering === 'accept'
        ? this.publicApi.acceptEstimate(this.token, {
            pin: this.confirmPin,
            name: this.signName.trim(),
            acceptTerms: this.acceptTerms,
          })
        : this.publicApi.declineEstimate(this.token, {
            pin: this.confirmPin,
            reason: this.reason.trim() || undefined,
          });
    request.subscribe({
      next: (e) => {
        this.estimate = e;
        this.busy = false;
        this.answering = null;
        this.confirmPin = '';
      },
      error: (err: HttpErrorResponse) => {
        this.busy = false;
        this.confirmPin = '';
        this.handleError(err, (m) => (this.answerError = m));
      },
    });
  }

  /** Wrong PIN stays on the form; a link that closed meanwhile closes the page. */
  private handleError(err: HttpErrorResponse, show: (message: string) => void) {
    const body = err.error as { code?: string; message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body?.message[0] : body?.message;
    if (err.status === 410 || err.status === 423 || err.status === 404) {
      this.answering = null;
      this.close(message ?? 'This link is no longer valid.');
      return;
    }
    if (body?.code === 'ALREADY_ANSWERED') {
      this.answering = null;
      this.publicApi.unlockEstimate(this.token, this.pin || '').subscribe({ next: (e) => (this.estimate = e), error: () => undefined });
    }
    show(message ?? 'Something went wrong. Please try again.');
  }

  private close(message: string) {
    this.error = message;
    this.estimate = null;
    this.step = 'closed';
  }

  digitsOnly(value: string): string {
    return (value ?? '').replace(/\D/g, '').slice(0, 6);
  }

  billingLabel(p?: string) {
    if (p === 'monthly') return 'Monthly';
    if (p === 'annual') return 'Annual';
    if (p === 'one_time') return 'One-time';
    return '—';
  }

  statusLabel(s: string) {
    if (s === 'rejected') return 'Declined';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  statusClass(s: string) {
    switch (s) {
      case 'sent':
        return 'bg-blue-100 text-blue-700';
      case 'accepted':
        return 'bg-emerald-100 text-emerald-700';
      case 'rejected':
        return 'bg-rose-100 text-rose-700';
      case 'expired':
        return 'bg-amber-100 text-amber-700';
      case 'converted':
        return 'bg-indigo-100 text-indigo-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  /** Date-only field stored as UTC midnight: read it in UTC, or it shows the day before. */
  formatDate(value?: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }

  formatDateTime(value?: string | null) {
    if (!value) return '';
    return new Date(value).toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatNumber(value: number) {
    return Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
