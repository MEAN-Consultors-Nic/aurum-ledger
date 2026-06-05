import { Component, OnDestroy, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ConfirmService } from '../../core/services/confirm.service';
import { ClientsApiService } from '../../core/services/clients-api.service';
import { SiteAuditApiService } from '../../core/services/site-audit-api.service';
import { ClientItem } from '../../core/models/client.model';
import {
  PageSpeedSnapshot,
  SiteAudit,
  SuggestedLineItem,
} from '../../core/models/site-audit.model';

@Component({
  selector: 'app-site-audit-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <ng-container *ngIf="audit() as a">
      <div class="space-y-5">
        <!-- Header -->
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <a routerLink="/audits" class="text-[11px] text-slate-500 hover:text-slate-800">← Audits</a>
            <h1 class="mt-1 truncate text-2xl font-semibold text-slate-900">{{ hostname(a) }}</h1>
            <div class="mt-0.5 truncate text-xs text-slate-500">
              <a [href]="a.normalizedUrl" target="_blank" rel="noopener" class="hover:underline">{{ a.normalizedUrl }}</a>
              <span *ngIf="a.partnerName" class="ml-2 text-slate-400">· Partner: {{ a.partnerName }}</span>
              <span *ngIf="a.clientName" class="ml-2 text-slate-400">· Cliente: {{ a.clientName }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <span [class]="statusClass(a.status)">{{ a.status }}</span>
            <button
              *ngIf="a.status === 'completed'"
              type="button"
              (click)="regenerate()"
              [disabled]="regenerating()"
              class="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >{{ regenerating() ? 'Regenerating…' : 'Regenerate AI' }}</button>
            <button
              type="button"
              (click)="remove()"
              [disabled]="deleting()"
              class="rounded-md border border-rose-200 px-3 py-1.5 text-xs text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
            >{{ deleting() ? 'Deleting…' : 'Delete' }}</button>
          </div>
        </div>
        <div *ngIf="deleteError()" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {{ deleteError() }}
        </div>

        <!-- Running state -->
        <div *ngIf="a.status === 'pending' || a.status === 'running'" class="rounded-lg border border-sky-200 bg-sky-50 px-5 py-6 text-center">
          <div class="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-sky-500 border-t-transparent"></div>
          <p class="mt-3 text-sm font-medium text-sky-800">Running probes and AI analyses…</p>
          <p class="mt-1 text-[11px] text-sky-700">
            Typically 60–90 seconds. This page will refresh automatically.
          </p>
        </div>

        <!-- Failed state -->
        <div *ngIf="a.status === 'failed'" class="rounded-lg border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
          <strong class="font-semibold">Audit failed.</strong>
          <div class="mt-1 font-mono text-[11px] text-rose-700">{{ a.error || 'unknown error' }}</div>
        </div>

        <!-- Hero (screenshot + KPIs) -->
        <div *ngIf="a.status === 'completed'" class="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div class="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div *ngIf="a.screenshotUrl; else noShot" class="bg-slate-50">
              <img [src]="a.screenshotUrl" alt="Homepage screenshot" class="block max-h-[420px] w-full object-cover object-top" />
            </div>
            <ng-template #noShot>
              <div class="flex h-48 items-center justify-center text-xs text-slate-400">Screenshot unavailable</div>
            </ng-template>
          </div>
          <div class="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <div class="text-[10px] uppercase tracking-wide text-slate-400">Mobile perf</div>
              <div class="mt-1 flex items-baseline gap-1">
                <span [class]="scoreText(mobilePS()?.performance)">{{ mobilePS()?.performance ?? '—' }}</span>
                <span class="text-[11px] text-slate-400">/100</span>
              </div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <div class="text-[10px] uppercase tracking-wide text-slate-400">Desktop perf</div>
              <div class="mt-1 flex items-baseline gap-1">
                <span [class]="scoreText(desktopPS()?.performance)">{{ desktopPS()?.performance ?? '—' }}</span>
                <span class="text-[11px] text-slate-400">/100</span>
              </div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <div class="text-[10px] uppercase tracking-wide text-slate-400">Pages indexed</div>
              <div class="mt-1 text-2xl font-semibold text-slate-900">{{ a.findings.sitemap?.urlCount ?? '—' }}</div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-3">
              <div class="text-[10px] uppercase tracking-wide text-slate-400">Domain age</div>
              <div class="mt-1 text-2xl font-semibold text-slate-900">
                <ng-container *ngIf="a.findings.whois?.ageYears !== undefined; else noAge">{{ a.findings.whois?.ageYears }}y</ng-container>
                <ng-template #noAge>—</ng-template>
              </div>
              <div *ngIf="a.findings.whois?.registrar" class="mt-0.5 truncate text-[10px] text-slate-400">{{ a.findings.whois?.registrar }}</div>
            </div>
            <div class="rounded-lg border border-slate-200 bg-white p-3 col-span-2 lg:col-span-1">
              <div class="text-[10px] uppercase tracking-wide text-slate-400">SSL</div>
              <div *ngIf="a.findings.ssl?.daysRemaining !== undefined" class="mt-1 text-2xl font-semibold text-slate-900">{{ a.findings.ssl?.daysRemaining }}d</div>
              <div *ngIf="a.findings.ssl?.daysRemaining === undefined" class="mt-1 text-2xl font-semibold text-rose-700">—</div>
              <div *ngIf="a.findings.ssl?.issuer" class="mt-0.5 truncate text-[10px] text-slate-400">{{ a.findings.ssl?.issuer }}</div>
            </div>
          </div>
        </div>

        <!-- Executive summary -->
        <section *ngIf="a.ai.executiveSummary && a.status === 'completed'" class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Executive summary</h2>
          <div class="prose prose-sm mt-2 max-w-none whitespace-pre-line text-slate-700">{{ a.ai.executiveSummary }}</div>
        </section>

        <div *ngIf="a.status === 'completed'" class="grid gap-4 lg:grid-cols-2">
          <!-- Tech stack -->
          <section class="rounded-lg border border-slate-200 bg-white p-5">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Tech stack</h2>
            <div class="mt-3 flex flex-wrap gap-1.5">
              <span
                *ngFor="let h of a.findings.stack?.heuristics ?? []"
                class="rounded-full border px-2 py-0.5 text-[11px]"
                [class.border-navy-200]="h.confidence === 'high'"
                [class.bg-navy-50]="h.confidence === 'high'"
                [class.text-navy-700]="h.confidence === 'high'"
                [class.border-slate-200]="h.confidence !== 'high'"
                [class.text-slate-600]="h.confidence !== 'high'"
              >{{ h.name }} <span class="text-slate-400">·{{ h.confidence }}</span></span>
              <span *ngIf="(a.findings.stack?.heuristics?.length ?? 0) === 0" class="text-[11px] text-slate-400">No fingerprints detected.</span>
            </div>
            <p *ngIf="a.ai.stackReasoning" class="mt-3 whitespace-pre-line text-sm text-slate-700">{{ a.ai.stackReasoning }}</p>
          </section>

          <!-- SEO checklist -->
          <section class="rounded-lg border border-slate-200 bg-white p-5">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">SEO basics</h2>
            <ul class="mt-3 space-y-1.5 text-sm">
              <li *ngFor="let c of a.findings.seo?.checks ?? []" class="flex items-start gap-2">
                <span [class]="c.pass ? 'mt-0.5 text-emerald-600' : 'mt-0.5 text-rose-600'">{{ c.pass ? '✓' : '✗' }}</span>
                <span class="flex-1">
                  <span [class]="c.pass ? 'text-slate-800' : 'text-slate-800 font-medium'">{{ c.label }}</span>
                  <span *ngIf="c.detail" class="ml-1 text-[11px] text-slate-400">— {{ c.detail }}</span>
                </span>
              </li>
            </ul>
          </section>

          <!-- Performance -->
          <section class="rounded-lg border border-slate-200 bg-white p-5">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Performance · Core Web Vitals</h2>
            <div class="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div class="rounded-md border border-slate-200 p-2">
                <div class="text-slate-400">Mobile LCP</div>
                <div class="font-mono text-slate-900">{{ formatMs(mobilePS()?.lcp) }}</div>
              </div>
              <div class="rounded-md border border-slate-200 p-2">
                <div class="text-slate-400">Mobile CLS</div>
                <div class="font-mono text-slate-900">{{ mobilePS()?.cls ?? '—' }}</div>
              </div>
              <div class="rounded-md border border-slate-200 p-2">
                <div class="text-slate-400">Mobile INP</div>
                <div class="font-mono text-slate-900">{{ formatMs(mobilePS()?.inp) }}</div>
              </div>
              <div class="rounded-md border border-slate-200 p-2">
                <div class="text-slate-400">Mobile FCP</div>
                <div class="font-mono text-slate-900">{{ formatMs(mobilePS()?.fcp) }}</div>
              </div>
            </div>
            <div *ngIf="(mobilePS()?.topOpportunities?.length ?? 0) > 0" class="mt-3 text-xs">
              <div class="text-[10px] uppercase tracking-wide text-slate-400">Top opportunities (mobile)</div>
              <ul class="mt-1 space-y-1">
                <li *ngFor="let o of mobilePS()?.topOpportunities ?? []" class="flex items-start justify-between gap-2">
                  <span class="flex-1 text-slate-700">{{ o.title }}</span>
                  <span class="font-mono text-slate-500">~{{ formatMs(o.savingsMs) }}</span>
                </li>
              </ul>
            </div>
          </section>

          <!-- Social presence -->
          <section class="rounded-lg border border-slate-200 bg-white p-5">
            <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Social presence</h2>
            <div class="mt-3 flex flex-wrap gap-2">
              <a
                *ngFor="let s of a.findings.social ?? []"
                [href]="s.url"
                target="_blank"
                rel="noopener"
                class="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] capitalize text-slate-700 transition hover:border-navy-300 hover:text-navy-700"
              >{{ s.platform }}</a>
              <span *ngIf="(a.findings.social?.length ?? 0) === 0" class="text-[11px] text-slate-400">No social links detected on the homepage.</span>
            </div>
          </section>
        </div>

        <!-- AI sections -->
        <section *ngIf="a.ai.visualCritique && a.status === 'completed'" class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Visual / UX critique</h2>
          <div class="prose prose-sm mt-2 max-w-none whitespace-pre-line text-slate-700">{{ a.ai.visualCritique }}</div>
        </section>

        <section *ngIf="a.ai.contentAnalysis && a.status === 'completed'" class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Content analysis</h2>
          <div class="prose prose-sm mt-2 max-w-none whitespace-pre-line text-slate-700">{{ a.ai.contentAnalysis }}</div>
        </section>

        <!-- Suggested line items -->
        <section *ngIf="(a.ai.suggestedLineItems?.length ?? 0) > 0 && a.status === 'completed'" class="rounded-lg border border-slate-200 bg-white p-5">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Suggested scope</h2>
              <p class="mt-0.5 text-xs text-slate-500">Toggle items, set your hourly rate, and convert to a draft estimate.</p>
            </div>
            <div class="flex items-center gap-3 text-xs">
              <label class="flex items-center gap-1.5 text-slate-600">
                Rate $
                <input
                  type="number"
                  [(ngModel)]="hourlyRate"
                  name="rate"
                  min="1"
                  class="w-20 rounded-md border border-slate-200 px-2 py-1 text-right text-xs font-mono focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                />
                /h
              </label>
              <div class="text-slate-700">
                <span class="text-slate-400">Total:</span>
                <span class="ml-1 font-semibold">{{ selectedTotalHours() }}h · \${{ selectedTotalCost().toLocaleString() }}</span>
              </div>
            </div>
          </div>

          <table class="mt-4 w-full text-sm">
            <thead class="text-left text-[11px] uppercase tracking-wide text-slate-500">
              <tr class="border-b border-slate-200">
                <th class="w-8 py-2"></th>
                <th class="py-2">Title</th>
                <th class="py-2">Category</th>
                <th class="py-2 text-right">Hours</th>
                <th class="py-2 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let it of (a.ai.suggestedLineItems ?? []); let i = index" class="border-b border-slate-100">
                <td class="py-2 align-top">
                  <input type="checkbox" [(ngModel)]="selected[i]" name="sel-{{ i }}" class="h-3.5 w-3.5 accent-navy-700"/>
                </td>
                <td class="py-2 align-top">
                  <div class="font-medium text-slate-900">{{ it.title }}</div>
                  <div *ngIf="it.description" class="text-[11px] text-slate-500">{{ it.description }}</div>
                </td>
                <td class="py-2 align-top">
                  <span *ngIf="it.category" class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] capitalize text-slate-600">{{ it.category }}</span>
                </td>
                <td class="py-2 text-right align-top font-mono text-slate-700">{{ it.hours }}h</td>
                <td class="py-2 text-right align-top font-mono text-slate-700">\${{ (it.hours * hourlyRate).toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="convertedEstimateId(); else convertCta" class="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            ✓ Estimate created.
            <a [routerLink]="['/estimates', convertedEstimateId()]" class="ml-1 font-medium underline">Open it →</a>
          </div>

          <ng-template #convertCta>
            <div class="mt-4 flex flex-wrap items-end justify-end gap-2">
              <div class="text-xs text-slate-600">
                <label class="block">Convert as client:</label>
                <select
                  [(ngModel)]="convertClientId"
                  name="convertClient"
                  class="mt-1 rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                >
                  <option [value]="a.clientId ?? ''">{{ a.clientName || 'Use audit client' }}</option>
                  <option *ngFor="let c of clients()" [value]="c._id">{{ c.name }}</option>
                </select>
              </div>
              <button
                type="button"
                (click)="convert()"
                [disabled]="converting() || selectedCount() === 0"
                class="rounded-md bg-navy-700 px-3 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:bg-slate-300"
              >{{ converting() ? 'Converting…' : 'Convert to estimate' }}</button>
            </div>
            <p *ngIf="convertError()" class="mt-2 text-right text-xs text-rose-700">{{ convertError() }}</p>
          </ng-template>
        </section>

        <!-- Sitemap details -->
        <section *ngIf="a.findings.sitemap?.found && a.status === 'completed'" class="rounded-lg border border-slate-200 bg-white p-5">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Sitemap sample</h2>
          <div class="mt-1 text-xs text-slate-500">
            {{ a.findings.sitemap?.urlCount }} URLs in <code class="font-mono">{{ a.findings.sitemap?.sitemapUrl }}</code>
          </div>
          <ul class="mt-3 max-h-48 space-y-0.5 overflow-y-auto rounded-md border border-slate-100 bg-slate-50 p-2 font-mono text-[11px]">
            <li *ngFor="let u of a.findings.sitemap?.sampleUrls ?? []" class="truncate text-slate-600">{{ u }}</li>
          </ul>
        </section>
      </div>
    </ng-container>
  `,
})
export class SiteAuditDetailComponent implements OnInit, OnDestroy {
  audit = signal<SiteAudit | null>(null);
  clients = signal<ClientItem[]>([]);
  selected: boolean[] = [];
  hourlyRate = 40;
  regenerating = signal(false);
  converting = signal(false);
  convertError = signal('');
  convertedEstimateId = signal<string | null>(null);
  convertClientId = '';
  deleting = signal(false);
  deleteError = signal('');

  mobilePS = computed<PageSpeedSnapshot | undefined>(
    () => this.audit()?.findings?.pageSpeed?.mobile,
  );
  desktopPS = computed<PageSpeedSnapshot | undefined>(
    () => this.audit()?.findings?.pageSpeed?.desktop,
  );

  selectedCount = computed(() => this.selected.filter(Boolean).length);
  selectedTotalHours = computed(() => {
    const items = this.audit()?.ai?.suggestedLineItems ?? [];
    let sum = 0;
    items.forEach((it, i) => {
      if (this.selected[i]) sum += it.hours || 0;
    });
    return sum;
  });
  selectedTotalCost = computed(() => this.selectedTotalHours() * this.hourlyRate);

  private pollHandle: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly api: SiteAuditApiService,
    private readonly router: Router,
    private readonly confirm: ConfirmService,
    private readonly clientsApi: ClientsApiService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.load(id);
    this.clientsApi.list({ limit: 200, isActive: true }).subscribe({
      next: (res) => this.clients.set(res.items ?? []),
    });
  }

  ngOnDestroy() {
    if (this.pollHandle !== null) clearTimeout(this.pollHandle);
  }

  load(id: string) {
    this.api.findOne(id).subscribe({
      next: (a) => {
        this.audit.set(a);
        this.convertedEstimateId.set(a.convertedToEstimateId ?? null);
        const items = a.ai.suggestedLineItems ?? [];
        if (this.selected.length !== items.length) {
          this.selected = items.map(() => true);
        }
        if (a.status === 'pending' || a.status === 'running') {
          this.pollHandle = window.setTimeout(() => this.load(id), 4000);
        }
      },
    });
  }

  regenerate() {
    const a = this.audit();
    if (!a) return;
    this.regenerating.set(true);
    this.api.regenerateAi(a._id).subscribe({
      next: (next) => {
        this.audit.set(next);
        this.regenerating.set(false);
      },
      error: () => this.regenerating.set(false),
    });
  }

  async remove() {
    const a = this.audit();
    if (!a) return;
    const ok = await this.confirm.open({
      title: 'Delete audit',
      message: `Delete the audit for ${a.normalizedUrl}? This cannot be undone.`,
      danger: true,
      confirmText: 'Delete',
    });
    if (!ok) return;
    this.deleting.set(true);
    this.deleteError.set('');
    if (this.pollHandle !== null) {
      clearTimeout(this.pollHandle);
      this.pollHandle = null;
    }
    this.api.remove(a._id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.router.navigate(['/audits']);
      },
      error: (err) => {
        this.deleting.set(false);
        this.deleteError.set(
          err?.error?.message ??
            err?.message ??
            'Could not delete the audit. Check the API logs.',
        );
      },
    });
  }

  convert() {
    const a = this.audit();
    if (!a) return;
    this.converting.set(true);
    this.convertError.set('');
    const indexes: number[] = [];
    this.selected.forEach((v, i) => v && indexes.push(i));
    this.api
      .convertToEstimate(a._id, {
        itemIndexes: indexes,
        clientId: this.convertClientId || undefined,
        hourlyRate: this.hourlyRate,
      })
      .subscribe({
        next: (res) => {
          this.converting.set(false);
          this.convertedEstimateId.set(res.estimateId);
        },
        error: (err) => {
          this.converting.set(false);
          this.convertError.set(
            err?.error?.message ?? 'Could not create estimate (you need a client + at least one service in the catalog).',
          );
        },
      });
  }

  hostname(a: SiteAudit) {
    try {
      return new URL(a.normalizedUrl).hostname.replace(/^www\./, '');
    } catch {
      return a.url;
    }
  }

  formatMs(ms: number | undefined): string {
    if (ms === undefined) return '—';
    if (ms < 1000) return `${ms} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  }

  statusClass(s: string) {
    const base = 'rounded-full px-2.5 py-0.5 text-[11px] font-medium';
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

  scoreText(score: number | undefined) {
    const base = 'text-2xl font-semibold';
    if (score === undefined) return `${base} text-slate-300`;
    if (score >= 90) return `${base} text-emerald-700`;
    if (score >= 50) return `${base} text-amber-700`;
    return `${base} text-rose-700`;
  }
}
