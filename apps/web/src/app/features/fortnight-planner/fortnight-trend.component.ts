import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexDataLabels,
  ApexFill,
  ApexGrid,
  ApexLegend,
  ApexPlotOptions,
  ApexStroke,
  ApexTooltip,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule,
} from 'ng-apexcharts';
import { FortnightAnalytics, Money } from '../../core/models/fortnight-plan.model';

export type CurrencyView = 'USD' | 'NIO' | 'both';

type TrendChart = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis[];
  plotOptions: ApexPlotOptions;
  dataLabels: ApexDataLabels;
  stroke: ApexStroke;
  fill: ApexFill;
  legend: ApexLegend;
  tooltip: ApexTooltip;
  grid: ApexGrid;
  colors: string[];
};

/** Planned vs actual spending and the discipline score across recent fortnights. */
@Component({
  selector: 'app-fortnight-trend',
  standalone: true,
  imports: [CommonModule, NgApexchartsModule],
  template: `
    <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-slate-900">Trend</div>
          <div class="text-xs text-slate-500">
            Planned vs real spending per fortnight, how much of it was never planned, and your discipline score.
          </div>
        </div>
        <div *ngIf="analytics?.averageScore !== null && analytics?.averageScore !== undefined" class="text-right">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Average score</div>
          <div class="text-2xl font-semibold" [ngClass]="scoreColor(analytics!.averageScore)">
            {{ analytics!.averageScore }}
          </div>
        </div>
      </div>

      <div *ngIf="!analytics || analytics.periods.length === 0" class="py-10 text-center text-sm text-slate-500">
        The trend appears after your first planned fortnight.
      </div>

      <div *ngIf="chart && analytics && analytics.periods.length > 0" class="mt-4">
        <apx-chart
          [series]="chart.series"
          [chart]="chart.chart"
          [xaxis]="chart.xaxis"
          [yaxis]="chart.yaxis"
          [plotOptions]="chart.plotOptions"
          [dataLabels]="chart.dataLabels"
          [stroke]="chart.stroke"
          [fill]="chart.fill"
          [legend]="chart.legend"
          [tooltip]="chart.tooltip"
          [grid]="chart.grid"
          [colors]="chart.colors"
        ></apx-chart>
      </div>

      <div *ngIf="analytics && analytics.categories.length > 0" class="mt-5 border-t border-slate-100 pt-4">
        <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Where the money went · last {{ analytics.periods.length }} fortnight{{ analytics.periods.length === 1 ? '' : 's' }}
        </div>
        <table class="mt-3 w-full text-sm">
          <thead>
            <tr class="text-left text-[11px] uppercase tracking-wide text-slate-400">
              <th class="py-1 font-semibold">Category</th>
              <th class="py-1 text-right font-semibold">Planned</th>
              <th class="py-1 text-right font-semibold">Actual</th>
              <th class="py-1 text-right font-semibold">Unplanned</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr *ngFor="let c of analytics.categories">
              <td class="py-1.5 text-slate-800">{{ c.name }}</td>
              <td class="py-1.5 text-right text-slate-500">{{ usd(c.plannedUsd) }}</td>
              <td class="py-1.5 text-right font-medium text-slate-900">{{ usd(c.actualUsd) }}</td>
              <td class="py-1.5 text-right" [ngClass]="c.unplannedUsd > 0 ? 'text-amber-700' : 'text-slate-400'">
                {{ usd(c.unplannedUsd) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class FortnightTrendComponent implements OnChanges {
  @Input() analytics: FortnightAnalytics | null = null;
  @Input() currency: CurrencyView = 'USD';

  chart: TrendChart | null = null;

  ngOnChanges() {
    this.chart = this.analytics ? this.buildChart(this.analytics) : null;
  }

  private value(m: Money) {
    return this.currency === 'NIO' ? Math.round(m.totalNio) : Math.round(m.totalUsd * 100) / 100;
  }

  usd(value: number) {
    if (this.currency === 'NIO' && this.analytics) {
      return `C$${(value * this.analytics.fxRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  scoreColor(score: number | null) {
    if (score === null) return 'text-slate-400';
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
  }

  private buildChart(a: FortnightAnalytics): TrendChart {
    const symbol = this.currency === 'NIO' ? 'C$' : '$';
    const categories = a.periods.map((p) => p.label.replace(/, \d{4}$/, ''));
    return {
      series: [
        { name: 'Planned spend', type: 'column', data: a.periods.map((p) => this.value(p.expensePlanned)) },
        { name: 'Actual spend', type: 'column', data: a.periods.map((p) => this.value(p.actualSpend)) },
        { name: 'Unplanned', type: 'column', data: a.periods.map((p) => this.value(p.unplannedExpense)) },
        { name: 'Score', type: 'line', data: a.periods.map((p) => p.discipline?.score ?? null) as number[] },
      ],
      chart: {
        type: 'line',
        height: 320,
        fontFamily: 'inherit',
        toolbar: { show: false },
        zoom: { enabled: false },
      },
      colors: ['#cbd5e1', '#1E3A5F', '#f59e0b', '#10b981'],
      plotOptions: { bar: { columnWidth: '55%', borderRadius: 3 } },
      dataLabels: { enabled: false },
      stroke: { width: [0, 0, 0, 3], curve: 'smooth' },
      fill: { opacity: 1 },
      xaxis: {
        categories,
        labels: { style: { colors: '#64748b', fontSize: '11px' } },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: [
        {
          seriesName: 'Planned spend',
          labels: {
            formatter: (v: number) => `${symbol}${v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0)}`,
            style: { colors: '#94a3b8', fontSize: '11px' },
          },
        },
        { seriesName: 'Planned spend', show: false },
        { seriesName: 'Planned spend', show: false },
        {
          seriesName: 'Score',
          opposite: true,
          min: 0,
          max: 100,
          labels: { formatter: (v: number) => (v === null ? '' : v.toFixed(0)), style: { colors: '#10b981' } },
        },
      ],
      grid: { borderColor: '#e2e8f0', strokeDashArray: 4 },
      legend: { position: 'bottom', horizontalAlign: 'left', fontSize: '12px' },
      tooltip: {
        shared: true,
        intersect: false,
        y: {
          formatter: (v: number, opts?: { seriesIndex: number }) =>
            v === null || v === undefined
              ? '—'
              : opts?.seriesIndex === 3
                ? `${v}/100`
                : `${symbol}${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
        },
      },
    };
  }
}
