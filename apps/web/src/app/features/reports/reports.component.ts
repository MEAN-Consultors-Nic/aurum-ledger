import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReportsApiService } from '../../core/services/reports-api.service';
import { PaymentsReportItem, ReceivableItem } from '../../core/models/report.model';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <div class="text-2xl font-semibold">Reports</div>
        <div class="text-sm text-slate-500">Receivables and payments summary</div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-sm font-semibold text-slate-800">Receivables by client</div>
          <div *ngIf="isLoadingReceivables" class="mt-2 text-sm text-slate-500">
            Loading...
          </div>
          <table *ngIf="!isLoadingReceivables" class="mt-4 w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="py-2">Client</th>
                <th class="py-2 text-right">USD</th>
                <th class="py-2 text-right">NIO</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of receivablesByClient" class="border-t border-slate-100">
                <td class="py-3">{{ item.name || '-' }}</td>
                <td class="py-3 text-right">{{ formatMoney(item.totalUsd, 'USD') }}</td>
                <td class="py-3 text-right">{{ formatMoney(item.totalNio, 'NIO') }}</td>
              </tr>
              <tr *ngIf="receivablesByClient.length === 0 && !isLoadingReceivables">
                <td colspan="3" class="py-4 text-center text-sm text-slate-500">No data</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-sm font-semibold text-slate-800">Receivables by service</div>
          <div *ngIf="isLoadingReceivables" class="mt-2 text-sm text-slate-500">
            Loading...
          </div>
          <table *ngIf="!isLoadingReceivables" class="mt-4 w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="py-2">Service</th>
                <th class="py-2 text-right">USD</th>
                <th class="py-2 text-right">NIO</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of receivablesByService" class="border-t border-slate-100">
                <td class="py-3">{{ item.name || '-' }}</td>
                <td class="py-3 text-right">{{ formatMoney(item.totalUsd, 'USD') }}</td>
                <td class="py-3 text-right">{{ formatMoney(item.totalNio, 'NIO') }}</td>
              </tr>
              <tr *ngIf="receivablesByService.length === 0 && !isLoadingReceivables">
                <td colspan="3" class="py-4 text-center text-sm text-slate-500">No data</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div class="text-sm font-semibold text-slate-800">Payments by date range</div>
            <div class="text-xs text-slate-500">Select dates to filter payments</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <input
              type="date"
              [(ngModel)]="paymentsFrom"
              class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              type="date"
              [(ngModel)]="paymentsTo"
              class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white"
              (click)="loadPayments()"
            >
              Search
            </button>
          </div>
        </div>

        <div *ngIf="isLoadingPayments" class="mt-3 text-sm text-slate-500">Loading payments...</div>
        <div *ngIf="paymentsError" class="mt-3 text-sm text-red-600">{{ paymentsError }}</div>

        <div class="mt-4 flex items-center justify-between">
          <div class="text-xs uppercase tracking-wide text-slate-400">Total applied USD</div>
          <div class="text-lg font-semibold">{{ formatMoney(paymentsTotalUsd, 'USD') }}</div>
        </div>
        <div class="mt-2 flex items-center justify-between">
          <div class="text-xs uppercase tracking-wide text-slate-400">Total applied NIO</div>
          <div class="text-lg font-semibold">{{ formatMoney(paymentsTotalNio, 'NIO') }}</div>
        </div>

        <table *ngIf="!isLoadingPayments" class="mt-4 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Client</th>
              <th class="py-2">Contract</th>
              <th class="py-2">Date</th>
              <th class="py-2">Amount</th>
              <th class="py-2">Retention</th>
              <th class="py-2">Currency</th>
              <th class="py-2">Method</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of payments" class="border-t border-slate-100">
              <td class="py-3">{{ paymentClient(item) }}</td>
              <td class="py-3">{{ paymentContract(item) }}</td>
              <td class="py-3">{{ formatDate(item.paymentDate) }}</td>
              <td class="py-3">{{ formatMoney(item.amount, resolveCurrency(item.currency)) }}</td>
              <td class="py-3">{{ formatMoney(item.retentionAmount || 0, resolveCurrency(item.currency)) }}</td>
              <td class="py-3">{{ resolveCurrency(item.currency) }}</td>
              <td class="py-3">{{ methodLabel(item.method) }}</td>
            </tr>
            <tr *ngIf="payments.length === 0 && !isLoadingPayments">
              <td colspan="7" class="py-4 text-center text-sm text-slate-500">No payments</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ReportsComponent implements OnInit {
  receivablesByClient: ReceivableItem[] = [];
  receivablesByService: ReceivableItem[] = [];
  isLoadingReceivables = false;

  payments: PaymentsReportItem[] = [];
  paymentsTotalUsd = 0;
  paymentsTotalNio = 0;
  isLoadingPayments = false;
  paymentsError = '';
  paymentsFrom = '';
  paymentsTo = '';

  constructor(private readonly reportsApi: ReportsApiService) {}

  ngOnInit() {
    this.loadReceivables();
    this.loadPayments();
  }

  loadReceivables() {
    this.isLoadingReceivables = true;
    this.reportsApi.receivables('client').subscribe({
      next: (items) => {
        this.receivablesByClient = items;
        this.isLoadingReceivables = false;
      },
      error: () => {
        this.isLoadingReceivables = false;
      },
    });

    this.reportsApi.receivables('service').subscribe({
      next: (items) => {
        this.receivablesByService = items;
      },
    });
  }

  loadPayments() {
    this.isLoadingPayments = true;
    this.paymentsError = '';
    this.reportsApi.paymentsReport(this.paymentsFrom || undefined, this.paymentsTo || undefined).subscribe({
      next: (response) => {
        this.payments = response.items;
        this.paymentsTotalUsd = response.totalUsd;
        this.paymentsTotalNio = response.totalNio;
        this.isLoadingPayments = false;
      },
      error: () => {
        this.isLoadingPayments = false;
        this.paymentsError = 'Unable to load report';
      },
    });
  }

  paymentClient(item: PaymentsReportItem) {
    if (typeof item.clientId === 'string') {
      return item.clientId;
    }
    return item.clientId?.name ?? '-';
  }

  paymentContract(item: PaymentsReportItem) {
    if (typeof item.contractId === 'string') {
      return item.contractId;
    }
    return item.contractId?.title ?? '-';
  }

  formatMoney(amount: number, currency: 'USD' | 'NIO' = 'USD') {
    const value = Number(amount ?? 0).toFixed(2);
    return `${currency} ${value}`;
  }

  resolveCurrency(currency?: string): 'USD' | 'NIO' {
    return currency === 'NIO' ? 'NIO' : 'USD';
  }

  formatDate(date?: string) {
    if (!date) {
      return '-';
    }
    return new Date(date).toLocaleDateString('en-US');
  }

  methodLabel(method: PaymentsReportItem['method']) {
    if (method === 'cash') {
      return 'Cash';
    }
    if (method === 'bank') {
      return 'Bank';
    }
    if (method === 'card') {
      return 'Card';
    }
    if (method === 'transfer') {
      return 'Transfer';
    }
    return 'Other';
  }
}
