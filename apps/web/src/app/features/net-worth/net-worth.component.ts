import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { ConfirmService } from '../../core/services/confirm.service';
import { AssetsApiService } from '../../core/services/assets-api.service';
import {
  NetWorthApiService,
} from '../../core/services/net-worth-api.service';
import { AssetItem, AssetType } from '../../core/models/asset.model';
import {
  NetWorthCurrent,
  NetWorthDelta,
  NetWorthSnapshot,
} from '../../core/models/net-worth.model';

type ChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  stroke: ApexStroke;
  fill: ApexFill;
  dataLabels: ApexDataLabels;
  tooltip: ApexTooltip;
  grid: ApexGrid;
  colors: string[];
};

type AssetDraft = {
  _id?: string;
  name: string;
  type: AssetType;
  currency: 'USD' | 'NIO';
  currentValue: number;
  notes: string;
};

const ASSET_TYPE_LABEL: Record<AssetType, string> = {
  real_estate: 'Real estate',
  vehicle: 'Vehicle',
  investment: 'Investment',
  retirement: 'Retirement',
  crypto: 'Crypto',
  cash_equivalent: 'Cash-equivalent',
  receivable: 'Receivable',
  other: 'Other',
};

const RANGE_OPTIONS = [
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '180d', days: 180 },
  { label: '365d', days: 365 },
];

@Component({
  selector: 'app-net-worth',
  standalone: true,
  imports: [CommonModule, FormsModule, NgApexchartsModule],
  template: `
    <div class="space-y-6">
      <!-- HERO -->
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-slate-900">Net worth</div>
          <div class="mt-1 text-sm text-slate-500">
            Live snapshot of everything you own minus what you owe — all in USD using
            <span *ngIf="current" class="font-medium text-slate-700">
              NIO {{ current.fxRate }} = USD 1
            </span>.
          </div>
        </div>
        <button
          (click)="takeSnapshot()"
          [disabled]="isSnapshotting"
          class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
        >
          {{ isSnapshotting ? 'Saving…' : 'Save snapshot now' }}
        </button>
      </header>

      <!-- KPI row -->
      <section *ngIf="current" class="grid gap-4 md:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Net worth (USD)
          </div>
          <div class="mt-1 text-3xl font-bold tracking-tight"
            [ngClass]="current.netWorthUsd >= 0 ? 'text-slate-900' : 'text-rose-700'">
            {{ current.netWorthUsd >= 0 ? '' : '-' }}USD {{ formatAmount(Math.abs(current.netWorthUsd)) }}
          </div>
          <div class="mt-1 text-xs text-slate-500">
            Native: USD {{ formatAmount(current.netWorthNativeUsd) }} · NIO {{ formatAmount(current.netWorthNativeNio) }}
          </div>
        </div>

        <div *ngFor="let range of [30, 90, 365]"
          class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Δ vs {{ range }}d ago
          </div>
          <ng-container *ngIf="getDelta(range) as d; else noDelta">
            <div class="mt-1 text-2xl font-semibold"
              [ngClass]="d.deltaUsd >= 0 ? 'text-emerald-700' : 'text-rose-700'">
              {{ d.deltaUsd >= 0 ? '+' : '' }}USD {{ formatAmount(d.deltaUsd) }}
            </div>
            <div class="text-xs"
              [ngClass]="d.deltaUsd >= 0 ? 'text-emerald-600' : 'text-rose-600'">
              {{ d.percent >= 0 ? '+' : '' }}{{ d.percent.toFixed(2) }}%
            </div>
          </ng-container>
          <ng-template #noDelta>
            <div class="mt-1 text-2xl font-semibold text-slate-300">—</div>
            <div class="text-xs text-slate-400">No history yet</div>
          </ng-template>
        </div>
      </section>

      <!-- Chart -->
      <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <header class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="text-sm font-semibold text-slate-900">Net worth history</div>
            <div class="text-xs text-slate-500">
              Daily snapshots in USD. Today's value is added live.
            </div>
          </div>
          <div class="flex gap-1 rounded-lg bg-slate-100 p-1">
            <button
              *ngFor="let opt of rangeOptions"
              (click)="selectRange(opt.days)"
              class="rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide transition"
              [ngClass]="opt.days === selectedDays
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-900'"
            >
              {{ opt.label }}
            </button>
          </div>
        </header>

        <div *ngIf="historyEmpty && !isLoadingHistory"
          class="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          No snapshots yet. Click <span class="font-semibold text-slate-700">Save snapshot now</span>
          to start tracking your net worth over time.
        </div>

        <div *ngIf="!historyEmpty" class="mt-4">
          <apx-chart
            [series]="chart.series"
            [chart]="chart.chart"
            [xaxis]="chart.xaxis"
            [yaxis]="chart.yaxis"
            [stroke]="chart.stroke"
            [fill]="chart.fill"
            [dataLabels]="chart.dataLabels"
            [tooltip]="chart.tooltip"
            [grid]="chart.grid"
            [colors]="chart.colors"
          />
        </div>
      </section>

      <!-- Composition -->
      <section *ngIf="current" class="grid gap-4 md:grid-cols-3">
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Cash</div>
          <div class="mt-1 text-xl font-semibold text-slate-900">
            USD {{ formatAmount(current.cashUsd + current.cashNio / current.fxRate) }}
          </div>
          <div class="text-xs text-slate-500">
            USD {{ formatAmount(current.cashUsd) }} · NIO {{ formatAmount(current.cashNio) }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">Assets</div>
          <div class="mt-1 text-xl font-semibold text-slate-900">
            USD {{ formatAmount(current.assetsUsd + current.assetsNio / current.fxRate) }}
          </div>
          <div class="text-xs text-slate-500">
            USD {{ formatAmount(current.assetsUsd) }} · NIO {{ formatAmount(current.assetsNio) }}
          </div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">Debts</div>
          <div class="mt-1 text-xl font-semibold text-slate-900">
            USD {{ formatAmount(current.debtsUsd + current.debtsNio / current.fxRate) }}
          </div>
          <div class="text-xs text-slate-500">
            USD {{ formatAmount(current.debtsUsd) }} · NIO {{ formatAmount(current.debtsNio) }}
          </div>
        </div>
      </section>

      <!-- Assets management -->
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <div>
            <div class="text-sm font-semibold text-slate-900">Assets</div>
            <div class="text-xs text-slate-500">
              Anything of value beyond your cash accounts. Update valuations monthly for accuracy.
            </div>
          </div>
          <button
            type="button"
            (click)="openCreate()"
            class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
          >
            + Add asset
          </button>
        </header>

        <div *ngIf="assets.length === 0" class="px-5 py-8 text-center text-sm text-slate-500">
          No assets yet. Add the things you own — house, car, investments, crypto, etc.
        </div>

        <table *ngIf="assets.length > 0" class="w-full text-sm">
          <thead class="text-left text-[10px] uppercase tracking-wider text-slate-500">
            <tr class="border-b border-slate-100">
              <th class="px-5 py-2.5 font-semibold">Name</th>
              <th class="px-5 py-2.5 font-semibold">Type</th>
              <th class="px-5 py-2.5 text-right font-semibold">Value</th>
              <th class="px-5 py-2.5 font-semibold">Last updated</th>
              <th class="px-5 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let asset of assets" class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
              <td class="px-5 py-3">
                <div class="font-medium text-slate-900">{{ asset.name }}</div>
                <div *ngIf="asset.notes" class="text-xs text-slate-500">{{ asset.notes }}</div>
              </td>
              <td class="px-5 py-3 text-slate-600">{{ typeLabel(asset.type) }}</td>
              <td class="px-5 py-3 text-right tabular-nums text-slate-900">
                {{ asset.currency }} {{ formatAmount(asset.currentValue) }}
              </td>
              <td class="px-5 py-3 text-xs text-slate-500">
                {{ formatDate(asset.lastValuationAt) || '—' }}
              </td>
              <td class="px-5 py-3 text-right">
                <button (click)="openEdit(asset)"
                  class="rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100">
                  Edit
                </button>
                <button (click)="remove(asset)"
                  class="rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-600 hover:bg-rose-50">
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>

    <!-- Asset form modal -->
    <div *ngIf="isFormOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-base font-semibold text-slate-900">
            {{ draft._id ? 'Edit asset' : 'New asset' }}
          </div>
          <button (click)="closeForm()" class="text-slate-400 hover:text-slate-700">✕</button>
        </div>
        <div class="mt-4 space-y-3">
          <div>
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Name</label>
            <input
              [(ngModel)]="draft.name"
              placeholder="e.g. Apartment in Las Colinas"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Type</label>
              <select
                [(ngModel)]="draft.type"
                class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              >
                <option *ngFor="let entry of typeEntries" [value]="entry.key">{{ entry.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Currency</label>
              <select
                [(ngModel)]="draft.currency"
                class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              >
                <option value="USD">USD</option>
                <option value="NIO">NIO</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Current value</label>
            <input
              [(ngModel)]="draft.currentValue"
              type="number"
              step="0.01"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </div>
          <div>
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Notes</label>
            <textarea
              [(ngModel)]="draft.notes"
              rows="2"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            ></textarea>
          </div>
          <div *ngIf="formError" class="text-xs text-rose-600">{{ formError }}</div>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button (click)="closeForm()"
            class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Cancel
          </button>
          <button
            (click)="save()"
            [disabled]="isSaving || !draft.name.trim()"
            class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
          >
            {{ isSaving ? 'Saving…' : (draft._id ? 'Save changes' : 'Create asset') }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class NetWorthComponent implements OnInit {
  current: NetWorthCurrent | null = null;
  history: NetWorthSnapshot[] = [];
  assets: AssetItem[] = [];
  selectedDays = 90;
  rangeOptions = RANGE_OPTIONS;

  isLoadingHistory = false;
  isSnapshotting = false;

  // form
  isFormOpen = false;
  isSaving = false;
  formError = '';
  draft: AssetDraft = this.blankDraft();
  typeEntries = (Object.keys(ASSET_TYPE_LABEL) as AssetType[]).map((key) => ({
    key,
    label: ASSET_TYPE_LABEL[key],
  }));

  chart: ChartOptions = this.buildChartOptions([]);
  readonly Math = Math;

  constructor(
    private readonly netWorthApi: NetWorthApiService,
    private readonly assetsApi: AssetsApiService,
    private readonly confirmDialog: ConfirmService,
  ) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loadCurrent();
    this.loadHistory();
    this.loadAssets();
  }

  loadCurrent() {
    this.netWorthApi.current().subscribe({
      next: (c) => (this.current = c),
    });
  }

  loadHistory() {
    this.isLoadingHistory = true;
    this.netWorthApi.history(this.selectedDays).subscribe({
      next: (snaps) => {
        this.history = snaps;
        this.refreshChart();
        this.isLoadingHistory = false;
      },
      error: () => {
        this.isLoadingHistory = false;
      },
    });
  }

  loadAssets() {
    this.assetsApi.list().subscribe({
      next: (items) => (this.assets = items),
    });
  }

  selectRange(days: number) {
    if (days === this.selectedDays) return;
    this.selectedDays = days;
    this.loadHistory();
  }

  takeSnapshot() {
    this.isSnapshotting = true;
    this.netWorthApi.takeSnapshot().subscribe({
      next: () => {
        this.isSnapshotting = false;
        this.loadHistory();
        this.loadCurrent();
      },
      error: () => {
        this.isSnapshotting = false;
      },
    });
  }

  get historyEmpty(): boolean {
    return this.history.length === 0 && !this.current;
  }

  getDelta(days: number): NetWorthDelta | null {
    if (!this.current) return null;
    const key = `d${days}` as 'd30' | 'd90' | 'd365';
    return this.current.deltas?.[key] ?? null;
  }

  // ---------- chart ----------

  private refreshChart() {
    const points: Array<[number, number]> = this.history.map((s) => [
      new Date(s.date).getTime(),
      Number(s.netWorthUsd.toFixed(2)),
    ]);
    if (this.current) {
      const todayKey = this.current.dateKey;
      const last = points[points.length - 1];
      const todayMs = new Date(this.current.date).getTime();
      if (!last || this.history[this.history.length - 1]?.dateKey !== todayKey) {
        points.push([todayMs, Number(this.current.netWorthUsd.toFixed(2))]);
      } else {
        // Refresh today's point with the live value.
        points[points.length - 1] = [todayMs, Number(this.current.netWorthUsd.toFixed(2))];
      }
    }
    this.chart = this.buildChartOptions(points);
  }

  private buildChartOptions(points: Array<[number, number]>): ChartOptions {
    return {
      series: [{ name: 'Net worth (USD)', data: points }],
      chart: {
        type: 'area',
        height: 320,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit',
      },
      colors: ['#0ea5e9'],
      stroke: { curve: 'smooth', width: 2.5 },
      fill: {
        type: 'gradient',
        gradient: {
          shadeIntensity: 1,
          opacityFrom: 0.35,
          opacityTo: 0.05,
          stops: [0, 95, 100],
        },
      },
      dataLabels: { enabled: false },
      tooltip: {
        x: { format: 'MMM dd, yyyy' },
        y: {
          formatter: (value) =>
            'USD ' +
            Number(value).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
        },
      },
      grid: {
        borderColor: '#e2e8f0',
        strokeDashArray: 4,
        padding: { left: 10, right: 10 },
      },
      xaxis: {
        type: 'datetime',
        labels: { style: { colors: '#64748b', fontSize: '11px' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: {
        labels: {
          style: { colors: '#64748b', fontSize: '11px' },
          formatter: (value) =>
            value >= 1000
              ? '$' + Math.round(value / 1000) + 'k'
              : '$' + Math.round(value),
        },
      },
    };
  }

  // ---------- assets ----------

  openCreate() {
    this.draft = this.blankDraft();
    this.formError = '';
    this.isFormOpen = true;
  }

  openEdit(asset: AssetItem) {
    this.draft = {
      _id: asset._id,
      name: asset.name,
      type: asset.type,
      currency: asset.currency,
      currentValue: asset.currentValue,
      notes: asset.notes ?? '',
    };
    this.formError = '';
    this.isFormOpen = true;
  }

  closeForm() {
    this.isFormOpen = false;
  }

  save() {
    if (!this.draft.name.trim()) {
      this.formError = 'Name is required';
      return;
    }
    this.isSaving = true;
    this.formError = '';
    const payload = {
      name: this.draft.name.trim(),
      type: this.draft.type,
      currency: this.draft.currency,
      currentValue: Number(this.draft.currentValue) || 0,
      notes: this.draft.notes?.trim() || undefined,
    };
    const obs = this.draft._id
      ? this.assetsApi.update(this.draft._id, payload)
      : this.assetsApi.create(payload);
    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.isFormOpen = false;
        this.loadAssets();
        this.loadCurrent();
      },
      error: (err) => {
        this.isSaving = false;
        this.formError = err?.error?.message ?? 'Unable to save asset';
      },
    });
  }

  async remove(asset: AssetItem) {
    const ok = await this.confirmDialog.open({
      title: 'Delete asset',
      message: `Remove "${asset.name}" from your net worth?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.assetsApi.remove(asset._id).subscribe({
      next: () => {
        this.assets = this.assets.filter((a) => a._id !== asset._id);
        this.loadCurrent();
      },
    });
  }

  // ---------- helpers ----------

  typeLabel(t: AssetType): string {
    return ASSET_TYPE_LABEL[t] ?? t;
  }

  formatAmount(value: number | undefined): string {
    return Number(value ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatDate(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private blankDraft(): AssetDraft {
    return {
      name: '',
      type: 'other',
      currency: 'USD',
      currentValue: 0,
      notes: '',
    };
  }
}
