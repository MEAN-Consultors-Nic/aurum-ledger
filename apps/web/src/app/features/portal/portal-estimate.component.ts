import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PublicApiService, PublicEstimate } from '../../core/services/public-api.service';

@Component({
  selector: 'app-portal-estimate',
  standalone: true,
  imports: [CommonModule],
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
        <div *ngIf="isLoading" class="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading proposal…
        </div>

        <!-- Error / revoked / not found -->
        <div *ngIf="error" class="rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
          <div class="text-base font-semibold text-rose-800">Link unavailable</div>
          <div class="mt-1 text-sm text-rose-700">
            {{ error }}
          </div>
          <div class="mt-4 text-xs text-rose-600">
            If you believe this is a mistake, please contact MEAN Consultors directly.
          </div>
        </div>

        <!-- Proposal content -->
        <article *ngIf="estimate" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header class="border-b border-slate-100 px-8 py-6">
            <div class="flex items-start justify-between gap-4">
              <div>
                <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Proposal</div>
                <h1 class="mt-1 text-2xl font-semibold text-slate-900">{{ estimate.title || 'Untitled proposal' }}</h1>
                <div class="mt-1 text-sm text-slate-500">
                  Prepared for <span class="font-medium text-slate-700">{{ estimate.clientName || 'client' }}</span>
                </div>
              </div>
              <span class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
                [ngClass]="statusClass(estimate.status)">
                {{ statusLabel(estimate.status) }}
              </span>
            </div>

            <dl class="mt-6 grid gap-4 sm:grid-cols-3">
              <div>
                <dt class="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Service</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ estimate.serviceName || '—' }}</dd>
              </div>
              <div>
                <dt class="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Billing</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ billingLabel(estimate.billingPeriod) }}</dd>
              </div>
              <div>
                <dt class="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Valid until</dt>
                <dd class="mt-1 text-sm text-slate-800">{{ formatDate(estimate.validUntil) }}</dd>
              </div>
            </dl>
          </header>

          <!-- Amount block -->
          <section class="bg-slate-900 px-8 py-6 text-white">
            <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-300">Total</div>
            <div class="mt-1 text-3xl font-bold tracking-tight">
              {{ estimate.currency }} {{ formatNumber(estimate.amount) }}
            </div>
            <div class="text-xs text-slate-300">{{ billingLabel(estimate.billingPeriod) }}</div>
          </section>

          <!-- Scope -->
          <section *ngIf="estimate.scope" class="border-b border-slate-100 px-8 py-6">
            <h2 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Scope of work</h2>
            <div class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{{ estimate.scope }}</div>
          </section>

          <!-- Deliverables -->
          <section *ngIf="estimate.deliverables?.length" class="border-b border-slate-100 px-8 py-6">
            <h2 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Deliverables</h2>
            <ul class="mt-3 space-y-2">
              <li *ngFor="let d of estimate.deliverables" class="flex items-start gap-3 text-sm text-slate-700">
                <span class="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-900"></span>
                <span>{{ d }}</span>
              </li>
            </ul>
          </section>

          <!-- Terms -->
          <section *ngIf="estimate.terms" class="px-8 py-6">
            <h2 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Terms &amp; conditions</h2>
            <div class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{{ estimate.terms }}</div>
          </section>

          <footer class="rounded-b-2xl border-t border-slate-100 bg-slate-50 px-8 py-4 text-center text-xs text-slate-500">
            Questions? Reach out to your account contact at MEAN Consultors to confirm or adjust this proposal.
          </footer>
        </article>

        <div class="mt-6 text-center text-[10px] uppercase tracking-[0.25em] text-slate-400">
          MEAN Consultors · Nicaragua
        </div>
      </main>
    </div>
  `,
})
export class PortalEstimateComponent implements OnInit {
  estimate: PublicEstimate | null = null;
  isLoading = true;
  error = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly publicApi: PublicApiService,
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!token) {
      this.error = 'This link is invalid.';
      this.isLoading = false;
      return;
    }
    this.publicApi.getEstimate(token).subscribe({
      next: (e) => {
        this.estimate = e;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'This link is no longer valid or has been revoked.';
        this.isLoading = false;
      },
    });
  }

  billingLabel(p?: string) {
    if (p === 'monthly') return 'Monthly';
    if (p === 'annual') return 'Annual';
    if (p === 'one_time') return 'One-time';
    return '—';
  }

  statusLabel(s: string) {
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

  formatDate(value?: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatNumber(value: number) {
    return Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
