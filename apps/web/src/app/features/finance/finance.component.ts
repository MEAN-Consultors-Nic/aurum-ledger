import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FinanceApiService } from '../../core/services/finance-api.service';
import {
  FinanceByCategoryItem,
  FinanceByClientItem,
  FinanceByContractItem,
  FinanceOverview,
} from '../../core/models/finance.model';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <div>
        <div class="text-2xl font-semibold">Personal finance</div>
        <div class="text-sm text-slate-500">Summary and analytics by category and client</div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-400">Total balance USD</div>
          <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatMoney(overview.balanceUsd, 'USD') }}</div>
        </div>
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-xs uppercase tracking-wide text-slate-400">Total balance NIO</div>
          <div class="mt-2 text-2xl font-semibold text-slate-900">{{ formatMoney(overview.balanceNio, 'NIO') }}</div>
        </div>
      </div>

      <div class="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2">
        <input
          type="number"
          [(ngModel)]="month"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Month"
        />
        <input
          type="number"
          [(ngModel)]="year"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          placeholder="Year"
        />
        <button
          class="rounded bg-slate-900 px-3 py-2 text-xs uppercase tracking-wide text-white lg:col-span-2"
          (click)="loadCategoryReport()"
        >
          View expenses by category
        </button>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-sm font-semibold text-slate-900">Expenses vs budget</div>
          <table class="mt-3 w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="py-2">Category</th>
                <th class="py-2">Amount</th>
                <th class="py-2">Budget</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of byCategory" class="border-t border-slate-100">
                <td class="py-2">{{ item.categoryName }}</td>
                <td class="py-2">{{ formatMoney(item.total, item.currency) }}</td>
                <td class="py-2">{{ formatMoney(item.budget, item.currency) }}</td>
              </tr>
              <tr *ngIf="byCategory.length === 0">
                <td colspan="3" class="py-4 text-center text-sm text-slate-500">No data</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-sm font-semibold text-slate-900">Income by client</div>
          <table class="mt-3 w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="py-2">Client</th>
                <th class="py-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let item of byClient" class="border-t border-slate-100">
                <td class="py-2">{{ item.clientName || item.clientId }}</td>
                <td class="py-2">{{ formatMoney(item.total, item.currency) }}</td>
              </tr>
              <tr *ngIf="byClient.length === 0">
                <td colspan="2" class="py-4 text-center text-sm text-slate-500">No data</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="text-sm font-semibold text-slate-900">Income by project</div>
        <table class="mt-3 w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th class="py-2">Project</th>
              <th class="py-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of byContract" class="border-t border-slate-100">
              <td class="py-2">{{ item.contractTitle || item.contractId }}</td>
              <td class="py-2">{{ formatMoney(item.total, item.currency) }}</td>
            </tr>
            <tr *ngIf="byContract.length === 0">
              <td colspan="2" class="py-4 text-center text-sm text-slate-500">No data</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class FinanceComponent implements OnInit {
  overview: FinanceOverview = { balanceUsd: 0, balanceNio: 0 };
  byCategory: FinanceByCategoryItem[] = [];
  byClient: FinanceByClientItem[] = [];
  byContract: FinanceByContractItem[] = [];
  month = new Date().getMonth() + 1;
  year = new Date().getFullYear();

  constructor(private readonly financeApi: FinanceApiService) {}

  ngOnInit() {
    this.loadOverview();
    this.loadCategoryReport();
    this.loadClientReport();
    this.loadContractReport();
  }

  loadOverview() {
    this.financeApi.overview().subscribe({
      next: (data) => (this.overview = data),
    });
  }

  loadCategoryReport() {
    this.financeApi.byCategory({ month: this.month, year: this.year }).subscribe({
      next: (items) => (this.byCategory = items),
    });
  }

  loadClientReport() {
    this.financeApi.byClient().subscribe({
      next: (items) => (this.byClient = items),
    });
  }

  loadContractReport() {
    this.financeApi.byContract().subscribe({
      next: (items) => (this.byContract = items),
    });
  }

  formatMoney(amount: number, currency: 'USD' | 'NIO') {
    return `${currency} ${Number(amount ?? 0).toFixed(2)}`;
  }
}
