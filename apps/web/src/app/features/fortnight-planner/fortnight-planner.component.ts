import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AccountItem } from '../../core/models/account.model';
import { CategoryItem } from '../../core/models/category.model';
import {
  Currency,
  FortnightAnalytics,
  FortnightDetail,
  Money,
  PlanLine,
  PlanLineKind,
} from '../../core/models/fortnight-plan.model';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { FortnightPlansApiService } from '../../core/services/fortnight-plans-api.service';
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';
import { CurrencyView, FortnightTrendComponent } from './fortnight-trend.component';
import { FortnightWizardComponent } from './fortnight-wizard.component';

type QuickAdd = { name: string; amount: number | null; currency: Currency; dueDate: string };

type ApplyForm = {
  line: PlanLine;
  amount: number | null;
  date: string;
  accountId: string;
  categoryId: string;
  toAccountId: string;
  note: string;
  keepRemainder: boolean;
};

type EditForm = {
  line: PlanLine | null;
  kind: PlanLineKind;
  name: string;
  plannedAmount: number | null;
  currency: Currency;
  accountId: string;
  categoryId: string;
  toAccountId: string;
  dueDate: string;
  note: string;
  repeat: boolean;
};

type UnplannedForm = {
  kind: 'expense' | 'income';
  name: string;
  amount: number | null;
  currency: Currency;
  accountId: string;
  categoryId: string;
  date: string;
  note: string;
};

const VIEW_KEY = 'helm_planner_currency_view';
const SECTIONS: Array<{ kind: PlanLineKind; title: string; hint: string }> = [
  { kind: 'income', title: 'Income', hint: 'What you expect to receive this fortnight.' },
  { kind: 'expense', title: 'Expenses & debts', hint: 'Loans, bills, people you pay — everything that has to go out.' },
  { kind: 'savings', title: 'Savings & provisions', hint: 'Money you set aside. Applied as a transfer between your accounts.' },
];

@Component({
  selector: 'app-fortnight-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, ActionMenuComponent, FortnightTrendComponent, FortnightWizardComponent],
  template: `
    <div class="space-y-6">
      <!-- HEADER -->
      <header class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-slate-900">Bi-weekly planner</div>
          <div class="mt-1 text-sm text-slate-500">
            Plan the fortnight, then apply each item as it actually happens. Everything you apply is recorded in your books.
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="flex items-center rounded-lg border border-slate-200 bg-white">
            <button class="px-2.5 py-2 text-slate-500 hover:text-slate-900 disabled:opacity-40" [disabled]="!detail"
              (click)="go(detail!.period.previousKey)" [attr.aria-label]="'Previous fortnight'">‹</button>
            <div class="min-w-[150px] px-2 text-center text-sm font-semibold text-slate-900">
              {{ detail?.period?.label ?? '…' }}
              <span *ngIf="detail?.period?.isCurrent" class="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-700">Now</span>
            </div>
            <button class="px-2.5 py-2 text-slate-500 hover:text-slate-900 disabled:opacity-40" [disabled]="!detail"
              (click)="go(detail!.period.nextKey)" [attr.aria-label]="'Next fortnight'">›</button>
          </div>
          <button *ngIf="detail && !detail.period.isCurrent" (click)="go(currentKey())"
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-600 hover:bg-slate-50">
            Today
          </button>
          <div class="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold" role="group" aria-label="Currency">
            <button *ngFor="let v of views" (click)="setView(v.key)"
              class="rounded-md px-2.5 py-1.5 transition"
              [ngClass]="view === v.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'">{{ v.label }}</button>
          </div>
          <ng-container *ngIf="detail?.plan as plan">
            <button *ngIf="plan.status === 'open' && !showWizard()" (click)="editing = true" [disabled]="busy"
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Edit plan
            </button>
            <button *ngIf="plan.status === 'open' && !showWizard()" (click)="sync()" [disabled]="busy"
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Sync
            </button>
            <button *ngIf="plan.status === 'open' && !showWizard()" (click)="closeModalOpen = true" [disabled]="busy"
              class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800 disabled:opacity-50">
              Close fortnight
            </button>
            <button *ngIf="plan.status === 'closed'" (click)="reopen()" [disabled]="busy"
              class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50">
              Reopen
            </button>
            <app-action-menu [items]="planActions()" />
          </ng-container>
        </div>
      </header>

      <div *ngIf="error" class="flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="alert">
        <span>{{ error }}</span>
        <button class="text-rose-500 hover:text-rose-700" (click)="error = ''" aria-label="Dismiss">✕</button>
      </div>

      <div *ngIf="detail?.previousOpen && detail?.plan?.status !== 'closed'"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <span><strong>{{ detail!.period.previousLabel }}</strong> is still open. Close it so whatever was not paid moves into this fortnight.</span>
        <button (click)="go(detail!.period.previousKey)" class="text-xs font-semibold uppercase tracking-wide text-amber-800 underline">Go to it</button>
      </div>

      <div *ngIf="loading && !detail" class="rounded-xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500">
        Loading fortnight…
      </div>

      <!-- PLANNING WIZARD (no plan yet, a draft, or editing) -->
      <app-fortnight-wizard *ngIf="detail && showWizard()"
        [detail]="detail" [accounts]="accounts" [categories]="categories" [view]="view"
        [canCancel]="!!detail.plan?.plannedAt"
        (detailChange)="setDetail($event)" (finished)="wizardDone()" (cancelled)="editing = false" />

      <ng-container *ngIf="detail?.plan && detail?.summary && !showWizard()">
        <div *ngIf="detail!.plan!.status === 'closed'" class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          This fortnight is closed. The figures below are frozen as they were when you closed it.
        </div>

        <!-- KPIs -->
        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Income</div>
            <div class="mt-2 text-xl font-semibold text-slate-900">{{ primary(s.income.planned) }}</div>
            <div *ngIf="alt(s.income.planned) as a" class="text-xs text-slate-400">{{ a }}</div>
            <div class="mt-1 text-xs text-slate-500">Received <span class="font-semibold text-emerald-700">{{ primary(s.income.applied) }}</span></div>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Expenses & debts</div>
            <div class="mt-2 text-xl font-semibold text-slate-900">{{ primary(s.expense.planned) }}</div>
            <div *ngIf="alt(s.expense.planned) as a" class="text-xs text-slate-400">{{ a }}</div>
            <div class="mt-1 text-xs text-slate-500">Paid <span class="font-semibold text-slate-800">{{ primary(s.expense.applied) }}</span> · to go {{ primary(s.expense.pending) }}</div>
          </div>
          <div class="rounded-xl border p-4 shadow-sm" [ngClass]="s.available.totalUsd >= 0 ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/60'">
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Available</div>
            <div class="mt-2 text-xl font-semibold" [ngClass]="s.available.totalUsd >= 0 ? 'text-emerald-700' : 'text-rose-700'">{{ primary(s.available) }}</div>
            <div *ngIf="alt(s.available) as a" class="text-xs text-slate-400">{{ a }}</div>
            <div class="mt-1 text-xs text-slate-500">Income − expenses − savings (planned)</div>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Cash now</div>
            <ng-container *ngIf="s.cashNow; else noCash">
              <div class="mt-2 text-xl font-semibold text-slate-900">{{ primary(s.cashNow) }}</div>
              <div *ngIf="alt(s.cashNow) as a" class="text-xs text-slate-400">{{ a }}</div>
              <div class="mt-1 text-xs text-slate-500">Free after the plan <span class="font-semibold" [ngClass]="s.projectedFree!.totalUsd >= 0 ? 'text-slate-800' : 'text-rose-700'">{{ primary(s.projectedFree!) }}</span></div>
            </ng-container>
            <ng-template #noCash><div class="mt-2 text-sm text-slate-400">Not tracked on closed fortnights</div></ng-template>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" [title]="disciplineHelp()">
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Discipline</div>
            <div class="mt-2 text-xl font-semibold" [ngClass]="scoreColor(s.discipline.score)">
              {{ s.discipline.score === null ? '—' : s.discipline.score + '/100' }}
            </div>
            <div class="mt-1 text-xs text-slate-500">
              <ng-container *ngIf="s.discipline.score !== null; else noScore">
                {{ pct(s.discipline.executionRate) }} on plan · {{ pct(s.discipline.unplannedShare) }} unplanned
              </ng-container>
              <ng-template #noScore>Scores once something is due</ng-template>
            </div>
          </div>
        </section>

        <!-- progress -->
        <section class="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>{{ s.counts.applied }} of {{ s.counts.total }} items done<span *ngIf="s.counts.skipped"> · {{ s.counts.skipped }} skipped</span><span *ngIf="s.counts.carried"> · {{ s.counts.carried }} moved</span></span>
            <span *ngIf="s.counts.overdue > 0" class="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">{{ s.counts.overdue }} overdue</span>
            <span class="font-semibold text-slate-900">{{ outflowProgress() }}% of outflows paid</span>
          </div>
          <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div class="h-full bg-emerald-500 transition-all" [style.width.%]="outflowProgress()"></div>
          </div>
          <div class="mt-2 text-[11px] text-slate-400">1 USD = C$ {{ detail!.fxRate }} · change it in Settings</div>
        </section>

        <!-- SECTIONS -->
        <section *ngFor="let section of sections" class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <div>
              <div class="text-sm font-semibold text-slate-900">{{ section.title }}</div>
              <div class="text-xs text-slate-500">{{ section.hint }}</div>
            </div>
            <div class="text-right text-xs text-slate-500">
              Planned <span class="font-semibold text-slate-900">{{ money(bucket(section.kind).planned) }}</span>
              · done <span class="font-semibold text-emerald-700">{{ money(bucket(section.kind).applied) }}</span>
            </div>
          </div>

          <ul class="divide-y divide-slate-100">
            <li *ngFor="let l of linesOf(section.kind); trackBy: trackLine"
              class="flex flex-wrap items-center gap-3 px-5 py-3"
              [ngClass]="{ 'bg-rose-50/40': l.overdue, 'opacity-60': l.status === 'skipped' || l.status === 'carried' }">
              <!-- status -->
              <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs"
                [ngClass]="statusDot(l)" [attr.title]="l.status">
                <span *ngIf="l.status === 'applied'">✓</span>
                <span *ngIf="l.status === 'carried'">→</span>
                <span *ngIf="l.status === 'applying'" class="animate-pulse">•</span>
              </div>

              <!-- name -->
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="font-medium text-slate-900" [class.line-through]="l.status === 'skipped'">{{ l.name }}</span>
                  <span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase" [ngClass]="sourceBadge(l).cls">{{ sourceBadge(l).label }}</span>
                  <span *ngIf="l.overdue" class="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">Overdue</span>
                  <span *ngIf="l.carriedFromPeriod" class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">From {{ shortPeriod(l.carriedFromPeriod) }}</span>
                  <span *ngIf="l.status === 'carried'" class="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">Moved to {{ shortPeriod(l.carriedToPeriod) }}</span>
                  <span *ngIf="l.repeat" class="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700" title="Copied into the next fortnight">Repeats</span>
                  <span *ngIf="l.status === 'applying'" class="text-[10px] font-semibold text-slate-500">Applying…</span>
                </div>
                <div class="mt-0.5 text-xs text-slate-500">
                  <span *ngIf="l.dueDay">Due {{ dayLabel(l.dueDay) }}</span>
                  <span *ngIf="l.accountName"> · {{ l.kind === 'income' ? 'into' : 'from' }} {{ l.accountName }}</span>
                  <span *ngIf="l.toAccountName"> → {{ l.toAccountName }}</span>
                  <span *ngIf="l.categoryName"> · {{ l.categoryName }}</span>
                  <span *ngIf="l.meta?.loanBalance !== undefined && l.source === 'loan'"> · balance {{ fmt(l.meta!.loanBalance!, l.currency) }}</span>
                  <span *ngIf="l.appliedDay"> · done {{ dayLabel(l.appliedDay) }}</span>
                  <span *ngIf="l.note" class="italic"> · {{ l.note }}</span>
                </div>
              </div>

              <!-- amounts -->
              <div class="w-32 text-right">
                <div class="text-sm font-semibold text-slate-900">{{ fmt(l.plannedAmount, l.currency) }}</div>
                <div *ngIf="secondary(l.plannedAmount, l.currency) as alt" class="text-[11px] text-slate-400">≈ {{ alt }}</div>
              </div>
              <div class="w-32 text-right">
                <ng-container *ngIf="l.status === 'applied'; else notApplied">
                  <div class="text-sm font-semibold" [ngClass]="variance(l) === 0 ? 'text-emerald-700' : 'text-amber-700'">
                    {{ fmt(l.appliedAmount ?? l.plannedAmount, l.currency) }}
                  </div>
                  <div *ngIf="variance(l) !== 0" class="text-[11px] text-amber-700">{{ variance(l) > 0 ? '+' : '' }}{{ fmt(variance(l), l.currency) }} vs plan</div>
                  <div *ngIf="variance(l) === 0 && l.appliedAccountCurrency && l.appliedAccountCurrency !== l.currency" class="text-[11px] text-slate-400">
                    {{ fmt(l.appliedAccountAmount ?? 0, l.appliedAccountCurrency) }} charged
                  </div>
                </ng-container>
                <ng-template #notApplied><div class="text-sm text-slate-300">—</div></ng-template>
              </div>

              <!-- actions -->
              <div class="flex w-40 items-center justify-end gap-1.5" *ngIf="isOpen()">
                <button *ngIf="l.status === 'planned'" (click)="openApply(l)" [disabled]="busyLine === l._id"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition disabled:opacity-50"
                  [ngClass]="l.overdue ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'">
                  {{ l.kind === 'income' ? 'Received' : 'Apply' }}
                </button>
                <button *ngIf="l.status === 'skipped'" (click)="act('restore', l)" [disabled]="busyLine === l._id"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                  Restore
                </button>
                <app-action-menu [items]="lineActions(l)" />
              </div>
            </li>
          </ul>

          <div *ngIf="linesOf(section.kind).length === 0" class="px-5 py-6 text-center text-sm text-slate-400">
            Nothing here yet.
          </div>

          <!-- quick add -->
          <form *ngIf="isOpen()" (ngSubmit)="quickAdd(section.kind)"
            class="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50/60 px-5 py-3">
            <input [(ngModel)]="quick[section.kind].name" name="name-{{ section.kind }}" placeholder="Add {{ section.kind === 'income' ? 'an income' : section.kind === 'savings' ? 'a provision' : 'an expense or debt' }}…"
              class="min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm" [attr.aria-label]="'Name'" />
            <input [(ngModel)]="quick[section.kind].amount" name="amount-{{ section.kind }}" type="number" min="0" step="0.01" placeholder="Amount"
              class="w-28 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm" [attr.aria-label]="'Amount'" />
            <select [(ngModel)]="quick[section.kind].currency" name="currency-{{ section.kind }}" class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" [attr.aria-label]="'Currency'">
              <option value="USD">USD</option>
              <option value="NIO">C$</option>
            </select>
            <input [(ngModel)]="quick[section.kind].dueDate" name="due-{{ section.kind }}" type="date" [min]="detail!.period.start" [max]="detail!.period.end"
              class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" [attr.aria-label]="'Due date'" />
            <button type="submit" [disabled]="busy || !quick[section.kind].name.trim() || !quick[section.kind].amount"
              class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40">Add</button>
            <button type="button" (click)="openCreate(section.kind)" class="text-xs font-semibold text-slate-500 underline hover:text-slate-800">More options</button>
          </form>
        </section>

        <!-- UNPLANNED -->
        <section class="rounded-xl border border-amber-200 bg-white shadow-sm">
          <div class="flex flex-wrap items-end justify-between gap-2 border-b border-amber-100 px-5 py-4">
            <div>
              <div class="text-sm font-semibold text-slate-900">Unplanned</div>
              <div class="text-xs text-slate-500">Money that moved this fortnight without being in the plan. This is where control is won or lost.</div>
            </div>
            <div class="flex items-center gap-3">
              <div class="text-right text-xs text-slate-500">
                Spent <span class="font-semibold text-amber-700">{{ money(s.unplanned.expense) }}</span>
                <span *ngIf="s.unplanned.income.totalUsd > 0"> · received {{ money(s.unplanned.income) }}</span>
              </div>
              <button *ngIf="isOpen()" (click)="openUnplanned()"
                class="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-800 hover:bg-amber-100">
                + Record
              </button>
            </div>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let l of unplannedLines(); trackBy: trackLine" class="flex flex-wrap items-center gap-3 px-5 py-2.5">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-slate-900">{{ l.name }}</div>
                <div class="text-xs text-slate-500">{{ dayLabel(l.appliedDay || l.dueDay) }} · {{ l.accountName }} · {{ l.categoryName }}<span *ngIf="l.kind === 'income'"> · income</span></div>
              </div>
              <div class="text-right text-sm font-semibold" [ngClass]="l.kind === 'income' ? 'text-emerald-700' : 'text-amber-700'">
                {{ fmt(l.appliedAmount ?? l.plannedAmount, l.currency) }}
              </div>
              <app-action-menu *ngIf="isOpen() && l.status === 'applied'" [items]="[{ label: 'Undo (void the movement)', action: undoFn(l), danger: true }]" />
            </li>
            <li *ngFor="let t of detail!.unplannedTransactions" class="flex flex-wrap items-center gap-3 px-5 py-2.5">
              <div class="min-w-0 flex-1">
                <div class="text-sm font-medium text-slate-900">{{ t.reference || t.notes || t.categoryName || 'Movement' }}</div>
                <div class="text-xs text-slate-500">{{ dayLabel(t.day) }} · {{ t.accountName }}<span *ngIf="t.categoryName"> · {{ t.categoryName }}</span> · from Transactions</div>
              </div>
              <div class="text-right text-sm font-semibold" [ngClass]="t.type === 'income' ? 'text-emerald-700' : 'text-amber-700'">
                {{ t.type === 'income' ? '+' : '' }}{{ fmt(t.amount, t.currency) }}
              </div>
            </li>
          </ul>
          <div *ngIf="unplannedLines().length === 0 && detail!.unplannedTransactions.length === 0" class="px-5 py-6 text-center text-sm text-slate-400">
            Nothing unplanned so far. 👌
          </div>
        </section>

        <!-- BY CATEGORY -->
        <section *ngIf="s.byCategory.length > 0" class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div class="text-sm font-semibold text-slate-900">By category</div>
          <div class="text-xs text-slate-500">Planned vs what really went out (paid from the plan + unplanned).</div>
          <div class="mt-4 space-y-3">
            <div *ngFor="let row of s.byCategory">
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium text-slate-800">{{ row.name }}</span>
                <span class="text-slate-500">
                  <span class="font-semibold text-slate-900">{{ money(row.actual) }}</span> / {{ money(row.planned) }}
                  <span *ngIf="row.unplanned.totalUsd > 0" class="text-amber-700"> · {{ money(row.unplanned) }} unplanned</span>
                </span>
              </div>
              <div class="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div class="h-full bg-emerald-500" [style.width.%]="barPct(row.applied.totalUsd, row)"></div>
                <div class="h-full bg-amber-400" [style.width.%]="barPct(row.unplanned.totalUsd, row)"></div>
              </div>
            </div>
          </div>
        </section>

        <!-- NOTES -->
        <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label class="text-sm font-semibold text-slate-900" for="plan-notes">Notes for this fortnight</label>
          <textarea id="plan-notes" [(ngModel)]="notes" (blur)="saveNotes()" rows="2" [disabled]="!isOpen()"
            placeholder="What to watch, decisions, lessons…"
            class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"></textarea>
        </section>
      </ng-container>

      <app-fortnight-trend *ngIf="!showWizard()" [analytics]="analytics" [currency]="view" />
    </div>

    <!-- APPLY MODAL -->
    <div *ngIf="applyForm as f" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" (click)="applyForm = null">
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="text-lg font-semibold text-slate-900">{{ f.line.kind === 'income' ? 'Mark as received' : 'Apply' }} · {{ f.line.name }}</div>
        <div class="mt-1 text-xs text-slate-500">
          Planned {{ fmt(f.line.plannedAmount, f.line.currency) }}<span *ngIf="f.line.dueDay"> · due {{ dayLabel(f.line.dueDay) }}</span>.
          <span *ngIf="f.line.source !== 'manual'">Recorded through {{ sourceBadge(f.line).label }}, which keeps its own balance.</span>
        </div>
        <form class="mt-4 space-y-4" (ngSubmit)="submitApply()">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Amount ({{ f.line.currency === 'NIO' ? 'C$' : 'USD' }})</label>
              <input [(ngModel)]="f.amount" name="amount" type="number" min="0.01" step="0.01" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Date</label>
              <input [(ngModel)]="f.date" name="date" type="date" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
          </div>

          <ng-container *ngIf="f.line.source === 'manual'; else sourceAccount">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">{{ f.line.kind === 'income' ? 'Into account' : 'From account' }}</label>
              <select [(ngModel)]="f.accountId" name="accountId" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select account</option>
                <option *ngFor="let a of accounts" [value]="a._id">{{ a.name }} ({{ a.currency }})</option>
              </select>
            </div>
            <div *ngIf="f.line.kind === 'savings'">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">To account</label>
              <select [(ngModel)]="f.toAccountId" name="toAccountId" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select account</option>
                <option *ngFor="let a of accounts" [value]="a._id" [disabled]="a._id === f.accountId">{{ a.name }} ({{ a.currency }})</option>
              </select>
            </div>
            <div *ngIf="f.line.kind !== 'savings'">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Category</label>
              <select [(ngModel)]="f.categoryId" name="categoryId" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select category</option>
                <option *ngFor="let c of categoriesFor(f.line.kind)" [value]="c._id">{{ c.name }}</option>
              </select>
            </div>
          </ng-container>
          <ng-template #sourceAccount>
            <div class="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {{ f.line.kind === 'income' ? 'Into' : 'From' }} <strong>{{ f.line.accountName || 'the account set on the source' }}</strong>
            </div>
          </ng-template>

          <div *ngIf="conversionPreview(f) as preview" class="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-800">{{ preview }}</div>

          <label *ngIf="f.line.source === 'manual' && f.amount !== null && f.amount < f.line.plannedAmount" class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" [(ngModel)]="f.keepRemainder" name="keepRemainder" />
            Keep the remaining {{ fmt(f.line.plannedAmount - (f.amount || 0), f.line.currency) }} as pending
          </label>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Note</label>
            <input [(ngModel)]="f.note" name="note" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>

          <div *ngIf="modalError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ modalError }}</div>
          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm text-slate-500" (click)="applyForm = null">Cancel</button>
            <button type="submit" [disabled]="busy || !f.amount" class="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50">
              {{ busy ? 'Saving…' : 'Confirm' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- EDIT / CREATE MODAL -->
    <div *ngIf="editForm as e" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" (click)="editForm = null">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="text-lg font-semibold text-slate-900">{{ e.line ? 'Edit ' + e.line.name : 'New line' }}</div>
        <div *ngIf="e.line && e.line.source !== 'manual'" class="mt-1 text-xs text-slate-500">
          This line comes from {{ sourceBadge(e.line).label }}. Here you only change what you plan to pay this fortnight; the schedule itself is edited there.
        </div>
        <form class="mt-4 space-y-4" (ngSubmit)="submitEdit()">
          <ng-container *ngIf="!e.line || e.line.source === 'manual'">
            <div class="grid grid-cols-3 gap-3">
              <div class="col-span-2">
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
                <input [(ngModel)]="e.name" name="name" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Type</label>
                <select [(ngModel)]="e.kind" name="kind" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="income">Income</option>
                  <option value="expense">Expense / debt</option>
                  <option value="savings">Savings</option>
                </select>
              </div>
            </div>
          </ng-container>
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Planned amount</label>
              <input [(ngModel)]="e.plannedAmount" name="plannedAmount" type="number" min="0" step="0.01" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Currency</label>
              <select [(ngModel)]="e.currency" name="currency" [disabled]="!!e.line && e.line.source !== 'manual'" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50">
                <option value="USD">USD</option>
                <option value="NIO">C$</option>
              </select>
            </div>
          </div>
          <ng-container *ngIf="!e.line || e.line.source === 'manual'">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">{{ e.kind === 'income' ? 'Into account' : 'From account' }}</label>
                <select [(ngModel)]="e.accountId" name="accountId" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Decide when applying</option>
                  <option *ngFor="let a of accounts" [value]="a._id">{{ a.name }} ({{ a.currency }})</option>
                </select>
              </div>
              <div *ngIf="e.kind === 'savings'; else catField">
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">To account</label>
                <select [(ngModel)]="e.toAccountId" name="toAccountId" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                  <option value="">Decide when applying</option>
                  <option *ngFor="let a of accounts" [value]="a._id">{{ a.name }} ({{ a.currency }})</option>
                </select>
              </div>
              <ng-template #catField>
                <div>
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Category</label>
                  <select [(ngModel)]="e.categoryId" name="categoryId" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">Decide when applying</option>
                    <option *ngFor="let c of categoriesFor(e.kind)" [value]="c._id">{{ c.name }}</option>
                  </select>
                </div>
              </ng-template>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Due date</label>
                <input [(ngModel)]="e.dueDate" name="dueDate" type="date" [min]="detail!.period.start" [max]="detail!.period.end" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <label class="mt-6 flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" [(ngModel)]="e.repeat" name="repeat" />
                Repeat every fortnight
              </label>
            </div>
          </ng-container>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Note</label>
            <input [(ngModel)]="e.note" name="note" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div *ngIf="modalError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ modalError }}</div>
          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm text-slate-500" (click)="editForm = null">Cancel</button>
            <button type="submit" [disabled]="busy || !e.name.trim() || e.plannedAmount === null" class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50">
              {{ busy ? 'Saving…' : 'Save' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- UNPLANNED MODAL -->
    <div *ngIf="unplannedForm as u" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" (click)="unplannedForm = null">
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="text-lg font-semibold text-slate-900">Record unplanned {{ u.kind === 'income' ? 'income' : 'spending' }}</div>
        <div class="mt-1 text-xs text-slate-500">It goes straight into your books and counts as unplanned in the analysis.</div>
        <form class="mt-4 space-y-4" (ngSubmit)="submitUnplanned()">
          <div class="flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
            <button type="button" class="flex-1 rounded-md py-1.5" [ngClass]="u.kind === 'expense' ? 'bg-slate-900 text-white' : 'text-slate-500'" (click)="u.kind = 'expense'; u.categoryId = ''">Spending</button>
            <button type="button" class="flex-1 rounded-md py-1.5" [ngClass]="u.kind === 'income' ? 'bg-slate-900 text-white' : 'text-slate-500'" (click)="u.kind = 'income'; u.categoryId = ''">Income</button>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">What</label>
            <input [(ngModel)]="u.name" name="name" required placeholder="Lunch, taxi, gift…" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</label>
              <input [(ngModel)]="u.amount" name="amount" type="number" min="0.01" step="0.01" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Currency</label>
              <select [(ngModel)]="u.currency" name="currency" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="USD">USD</option>
                <option value="NIO">C$</option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Account</label>
              <select [(ngModel)]="u.accountId" name="accountId" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select</option>
                <option *ngFor="let a of accounts" [value]="a._id">{{ a.name }} ({{ a.currency }})</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Category</label>
              <select [(ngModel)]="u.categoryId" name="categoryId" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Select</option>
                <option *ngFor="let c of categoriesFor(u.kind)" [value]="c._id">{{ c.name }}</option>
              </select>
            </div>
          </div>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Date</label>
            <input [(ngModel)]="u.date" name="date" type="date" [min]="detail!.period.start" [max]="detail!.period.end" required class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          </div>
          <div *ngIf="modalError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ modalError }}</div>
          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm text-slate-500" (click)="unplannedForm = null">Cancel</button>
            <button type="submit" [disabled]="busy || !u.name.trim() || !u.amount || !u.accountId || !u.categoryId"
              class="rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50">
              {{ busy ? 'Saving…' : 'Record' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- PROMOTE MODAL -->
    <div *ngIf="promoteLine" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" (click)="promoteLine = null">
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="text-lg font-semibold text-slate-900">Make "{{ promoteLine.name }}" recurring</div>
        <div class="mt-1 text-xs text-slate-500">
          It becomes a recurring expense of {{ fmt(promoteLine.plannedAmount, promoteLine.currency) }} from {{ promoteLine.accountName }}.
          Future fortnights pull it from the schedule instead of copying it.
        </div>
        <form class="mt-4 space-y-4" (ngSubmit)="submitPromote()">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Days of the month</label>
            <input [(ngModel)]="promoteDays" name="days" placeholder="15, 30" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            <div class="mt-1 text-[11px] text-slate-400">Use 15, 30 for something paid every fortnight.</div>
          </div>
          <div *ngIf="modalError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ modalError }}</div>
          <div class="flex justify-end gap-3">
            <button type="button" class="text-sm text-slate-500" (click)="promoteLine = null">Cancel</button>
            <button type="submit" [disabled]="busy || parseDays(promoteDays).length === 0" class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50">Create recurring expense</button>
          </div>
        </form>
      </div>
    </div>

    <!-- CLOSE MODAL -->
    <div *ngIf="closeModalOpen && detail?.summary" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4" (click)="closeModalOpen = false">
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="text-lg font-semibold text-slate-900">Close {{ detail!.period.label }}</div>
        <p class="mt-2 text-sm text-slate-600">
          The summary is frozen as it is now. {{ s.counts.planned }} item{{ s.counts.planned === 1 ? '' : 's' }} still pending.
        </p>
        <div class="mt-4 space-y-2" *ngIf="s.counts.planned > 0">
          <label class="flex items-start gap-2 text-sm text-slate-700">
            <input type="radio" name="pending" value="carry" [(ngModel)]="closePending" class="mt-1" />
            <span><strong>Move them to {{ detail!.period.nextLabel }}</strong> — they are still owed (recommended).</span>
          </label>
          <label class="flex items-start gap-2 text-sm text-slate-700">
            <input type="radio" name="pending" value="skip" [(ngModel)]="closePending" class="mt-1" />
            <span><strong>Drop them</strong> — they will not happen.</span>
          </label>
        </div>
        <div *ngIf="modalError" class="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ modalError }}</div>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="text-sm text-slate-500" (click)="closeModalOpen = false">Cancel</button>
          <button (click)="closePlan()" [disabled]="busy" class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50">
            {{ busy ? 'Closing…' : 'Close fortnight' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class FortnightPlannerComponent implements OnInit, OnDestroy {
  readonly sections = SECTIONS;
  readonly views: Array<{ key: CurrencyView; label: string }> = [
    { key: 'USD', label: 'USD' },
    { key: 'NIO', label: 'C$' },
    { key: 'both', label: 'Both' },
  ];

  periodKey = '';
  detail: FortnightDetail | null = null;
  analytics: FortnightAnalytics | null = null;
  accounts: AccountItem[] = [];
  categories: CategoryItem[] = [];
  view: CurrencyView = (localStorage.getItem(VIEW_KEY) as CurrencyView) || 'both';

  loading = false;
  busy = false;
  busyLine: string | null = null;
  error = '';
  modalError = '';
  notes = '';

  quick: Record<PlanLineKind, QuickAdd> = {
    income: this.blankQuick(),
    expense: this.blankQuick(),
    savings: this.blankQuick(),
  };
  applyForm: ApplyForm | null = null;
  editForm: EditForm | null = null;
  unplannedForm: UnplannedForm | null = null;
  promoteLine: PlanLine | null = null;
  promoteDays = '';
  closeModalOpen = false;
  closePending: 'carry' | 'skip' = 'carry';
  /** The user asked to go back into the wizard on a plan already confirmed. */
  editing = false;

  private routeSub?: Subscription;

  constructor(
    private readonly api: FortnightPlansApiService,
    private readonly accountsApi: AccountsApiService,
    private readonly categoriesApi: CategoriesApiService,
    private readonly confirmDialog: ConfirmService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.accountsApi.list({ isActive: true }).subscribe({ next: (items) => (this.accounts = items) });
    this.categoriesApi.list().subscribe({ next: (items) => (this.categories = items) });
    this.loadAnalytics();
    this.routeSub = this.route.paramMap.subscribe((params) => {
      this.periodKey = params.get('periodKey') || this.currentKey();
      this.load();
    });
  }

  ngOnDestroy() {
    this.routeSub?.unsubscribe();
  }

  /** The summary in view (only read when a plan exists). */
  get s() {
    return this.detail!.summary!;
  }

  // ------------------------------------------------------------- loading

  load() {
    this.loading = true;
    this.error = '';
    this.api.get(this.periodKey).subscribe({
      next: (detail) => this.setDetail(detail),
      error: (err) => {
        this.loading = false;
        this.error = this.apiError(err, 'Could not load this fortnight.');
      },
    });
  }

  loadAnalytics() {
    this.api.analytics(12).subscribe({ next: (data) => (this.analytics = data) });
  }

  go(periodKey: string) {
    this.editing = false;
    this.router.navigate(['/planner', periodKey]);
  }

  /** Planning happens in the wizard; tracking starts once the plan is confirmed. */
  showWizard() {
    const plan = this.detail?.plan;
    if (!plan) return true;
    if (plan.status !== 'open') return false;
    return !plan.plannedAt || this.editing;
  }

  wizardDone() {
    this.editing = false;
    this.loadAnalytics();
  }

  currentKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getDate() <= 15 ? 1 : 2}`;
  }

  setView(view: CurrencyView) {
    this.view = view;
    localStorage.setItem(VIEW_KEY, view);
  }

  setDetail(detail: FortnightDetail) {
    this.detail = detail;
    this.loading = false;
    this.notes = detail.plan?.notes ?? '';
    for (const kind of ['income', 'expense', 'savings'] as PlanLineKind[]) {
      if (!this.quick[kind].dueDate || !this.inPeriod(this.quick[kind].dueDate)) {
        this.quick[kind].dueDate = '';
      }
    }
  }

  /** Runs a mutation that returns the refreshed fortnight. */
  private run(
    request: ReturnType<FortnightPlansApiService['get']>,
    options: { line?: string; onDone?: () => void; modal?: boolean; fallback?: string } = {},
  ) {
    this.busy = true;
    this.busyLine = options.line ?? null;
    this.modalError = '';
    if (!options.modal) this.error = '';
    request.subscribe({
      next: (detail) => {
        this.busy = false;
        this.busyLine = null;
        this.setDetail(detail);
        options.onDone?.();
        this.loadAnalytics();
      },
      error: (err) => {
        this.busy = false;
        this.busyLine = null;
        const message = this.apiError(err, options.fallback ?? 'That did not work.');
        if (options.modal) this.modalError = message;
        else this.error = message;
        if (err?.status === 409) this.load();
      },
    });
  }

  // ------------------------------------------------------------- plan

  sync() {
    this.run(this.api.sync(this.periodKey));
  }

  reopen() {
    this.run(this.api.reopen(this.periodKey));
  }

  closePlan() {
    this.run(this.api.close(this.periodKey, this.closePending), {
      modal: true,
      onDone: () => (this.closeModalOpen = false),
    });
  }

  saveNotes() {
    if (!this.detail?.plan || this.notes === (this.detail.plan.notes ?? '')) return;
    this.api.updateNotes(this.periodKey, this.notes).subscribe({
      next: (detail) => this.setDetail(detail),
      error: (err) => (this.error = this.apiError(err, 'Could not save the notes.')),
    });
  }

  planActions(): ActionMenuItem[] {
    return [
      { label: 'Record unplanned spending', action: () => this.openUnplanned(), disabled: !this.isOpen() },
      { label: 'Delete this plan', action: () => this.deletePlan(), danger: true },
    ];
  }

  async deletePlan() {
    const ok = await this.confirmDialog.open({
      title: 'Delete this plan',
      message: `Delete the plan for ${this.detail?.period.label}? Only possible while nothing in it was applied. No movement is deleted.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(this.periodKey).subscribe({
      next: () => this.load(),
      error: (err) => (this.error = this.apiError(err, 'Could not delete the plan.')),
    });
  }

  isOpen() {
    return this.detail?.plan?.status === 'open';
  }

  // ------------------------------------------------------------- lines

  linesOf(kind: PlanLineKind) {
    return (this.detail?.plan?.lines ?? []).filter((l) => l.kind === kind && !l.unplanned);
  }

  unplannedLines() {
    return (this.detail?.plan?.lines ?? []).filter((l) => l.unplanned);
  }

  bucket(kind: PlanLineKind) {
    return this.s[kind];
  }

  trackLine(_: number, line: PlanLine) {
    return line._id;
  }

  quickAdd(kind: PlanLineKind) {
    const q = this.quick[kind];
    if (!q.name.trim() || !q.amount) return;
    this.run(
      this.api.addLine(this.periodKey, {
        kind,
        name: q.name.trim(),
        plannedAmount: Number(q.amount),
        currency: q.currency,
        dueDate: q.dueDate || undefined,
      }),
      { onDone: () => (this.quick[kind] = { ...this.blankQuick(), currency: q.currency }) },
    );
  }

  lineActions(l: PlanLine): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];
    const planned = l.status === 'planned';
    if (planned || l.status === 'skipped') items.push({ label: 'Edit', action: () => this.openEdit(l) });
    if (planned) {
      items.push({ label: 'Move to next fortnight', action: () => this.act('carry', l) });
      items.push({ label: 'Skip this fortnight', action: () => this.act('skip', l) });
    }
    if (l.source === 'manual' && l.kind === 'expense' && !l.promotedToRecurringId && (planned || l.status === 'applied')) {
      items.push({ label: 'Make recurring…', action: () => this.openPromote(l) });
    }
    if (l.canUndo) items.push({ label: 'Undo (void the movement)', action: this.undoFn(l), danger: true });
    if (l.source !== 'manual' && (planned || l.status === 'skipped')) {
      items.push({ label: `Omit in ${this.sourceBadge(l).label}…`, action: () => this.omit(l), danger: true });
    }
    if (l.source === 'manual' && (planned || l.status === 'skipped')) {
      items.push({ label: 'Remove', action: () => this.removeLine(l), danger: true });
    }
    if (items.length === 0) items.push({ label: 'No actions', action: () => undefined, disabled: true });
    return items;
  }

  act(action: 'skip' | 'restore' | 'carry', l: PlanLine) {
    const request =
      action === 'skip'
        ? this.api.skip(this.periodKey, l._id)
        : action === 'restore'
          ? this.api.restore(this.periodKey, l._id)
          : this.api.carry(this.periodKey, l._id);
    this.run(request, { line: l._id });
  }

  undoFn(l: PlanLine) {
    return async () => {
      const ok = await this.confirmDialog.open({
        title: 'Undo',
        message: `Void the movement of "${l.name}" (${this.fmt(l.appliedAmount ?? l.plannedAmount, l.currency)}) and put it back as pending?`,
        confirmText: 'Undo',
        danger: true,
      });
      if (ok) this.run(this.api.unapply(this.periodKey, l._id), { line: l._id });
    };
  }

  async omit(l: PlanLine) {
    const loanWarning =
      l.source === 'loan' && l.meta?.loanKind === 'interest_bearing'
        ? ' On an interest-bearing loan the unpaid interest of the period is added to the balance.'
        : '';
    const ok = await this.confirmDialog.open({
      title: `Omit in ${this.sourceBadge(l).label}`,
      message: `Mark "${l.name}" as not happening at all, in ${this.sourceBadge(l).label} too.${loanWarning} To just postpone it, use "Skip this fortnight" instead.`,
      confirmText: 'Omit',
      danger: true,
    });
    if (ok) this.run(this.api.omit(this.periodKey, l._id), { line: l._id });
  }

  async removeLine(l: PlanLine) {
    const ok = await this.confirmDialog.open({
      title: 'Remove line',
      message: `Remove "${l.name}" from this fortnight?`,
      confirmText: 'Remove',
      danger: true,
    });
    if (ok) this.run(this.api.removeLine(this.periodKey, l._id), { line: l._id });
  }

  // ------------------------------------------------------------- apply

  openApply(l: PlanLine) {
    this.modalError = '';
    this.applyForm = {
      line: l,
      amount: l.plannedAmount,
      date: this.defaultDate(),
      accountId: l.accountId ?? this.defaultAccount(l.currency),
      categoryId: l.categoryId ?? '',
      toAccountId: l.toAccountId ?? '',
      note: l.note ?? '',
      keepRemainder: false,
    };
  }

  submitApply() {
    const f = this.applyForm;
    if (!f || !f.amount) return;
    const manual = f.line.source === 'manual';
    this.run(
      this.api.apply(this.periodKey, f.line._id, {
        amount: Number(f.amount),
        date: f.date || undefined,
        accountId: manual ? f.accountId || undefined : undefined,
        categoryId: manual && f.line.kind !== 'savings' ? f.categoryId || undefined : undefined,
        toAccountId: manual && f.line.kind === 'savings' ? f.toAccountId || undefined : undefined,
        note: f.note || undefined,
        keepRemainder: manual && f.keepRemainder ? true : undefined,
      }),
      { modal: true, line: f.line._id, onDone: () => (this.applyForm = null) },
    );
  }

  conversionPreview(f: ApplyForm): string | null {
    if (!this.detail || !f.amount) return null;
    const accountCurrency =
      f.line.source === 'manual'
        ? this.accounts.find((a) => a._id === f.accountId)?.currency
        : f.line.accountCurrency ?? undefined;
    if (!accountCurrency || accountCurrency === f.line.currency) return null;
    const fx = this.detail.fxRate;
    const converted = accountCurrency === 'USD' ? f.amount / fx : f.amount * fx;
    return `${this.fmt(converted, accountCurrency)} will be charged to the account (1 USD = C$ ${fx}).`;
  }

  // ------------------------------------------------------------- edit / create

  openCreate(kind: PlanLineKind) {
    const q = this.quick[kind];
    this.modalError = '';
    this.editForm = {
      line: null,
      kind,
      name: q.name,
      plannedAmount: q.amount,
      currency: q.currency,
      accountId: '',
      categoryId: '',
      toAccountId: '',
      dueDate: q.dueDate,
      note: '',
      repeat: false,
    };
  }

  openEdit(l: PlanLine) {
    this.modalError = '';
    this.editForm = {
      line: l,
      kind: l.kind,
      name: l.name,
      plannedAmount: l.plannedAmount,
      currency: l.currency,
      accountId: l.accountId ?? '',
      categoryId: l.categoryId ?? '',
      toAccountId: l.toAccountId ?? '',
      dueDate: l.dueDay ?? '',
      note: l.note ?? '',
      repeat: !!l.repeat,
    };
  }

  submitEdit() {
    const e = this.editForm;
    if (!e || e.plannedAmount === null) return;
    if (e.line && e.line.source !== 'manual') {
      this.run(
        this.api.updateLine(this.periodKey, e.line._id, { plannedAmount: Number(e.plannedAmount), note: e.note }),
        { modal: true, onDone: () => (this.editForm = null) },
      );
      return;
    }
    const payload = {
      kind: e.kind,
      name: e.name.trim(),
      plannedAmount: Number(e.plannedAmount),
      currency: e.currency,
      accountId: e.accountId || undefined,
      categoryId: e.kind !== 'savings' ? e.categoryId || undefined : undefined,
      toAccountId: e.kind === 'savings' ? e.toAccountId || undefined : undefined,
      dueDate: e.dueDate || undefined,
      note: e.note || undefined,
      repeat: e.repeat,
    };
    const request = e.line
      ? this.api.updateLine(this.periodKey, e.line._id, payload)
      : this.api.addLine(this.periodKey, payload);
    this.run(request, {
      modal: true,
      onDone: () => {
        if (!e.line) this.quick[e.kind] = this.blankQuick();
        this.editForm = null;
      },
    });
  }

  // ------------------------------------------------------------- unplanned / promote

  openUnplanned() {
    this.modalError = '';
    this.unplannedForm = {
      kind: 'expense',
      name: '',
      amount: null,
      currency: 'USD',
      accountId: this.defaultAccount('USD'),
      categoryId: '',
      date: this.defaultDate(),
      note: '',
    };
  }

  submitUnplanned() {
    const u = this.unplannedForm;
    if (!u || !u.amount) return;
    this.run(
      this.api.recordUnplanned(this.periodKey, {
        kind: u.kind,
        name: u.name.trim(),
        amount: Number(u.amount),
        currency: u.currency,
        accountId: u.accountId,
        categoryId: u.categoryId,
        date: u.date || undefined,
        note: u.note || undefined,
      }),
      { modal: true, onDone: () => (this.unplannedForm = null) },
    );
  }

  openPromote(l: PlanLine) {
    this.modalError = '';
    this.promoteLine = l;
    this.promoteDays = l.dueDay ? String(Number(l.dueDay.slice(8, 10))) : '15, 30';
  }

  submitPromote() {
    const l = this.promoteLine;
    const days = this.parseDays(this.promoteDays);
    if (!l || days.length === 0) return;
    this.run(this.api.promote(this.periodKey, l._id, days), { modal: true, onDone: () => (this.promoteLine = null) });
  }

  parseDays(raw: string) {
    return Array.from(
      new Set(
        raw
          .split(',')
          .map((v) => Number(v.trim()))
          .filter((v) => Number.isInteger(v) && v >= 1 && v <= 31),
      ),
    ).slice(0, 4);
  }

  // ------------------------------------------------------------- display helpers

  categoriesFor(kind: PlanLineKind | 'expense' | 'income') {
    const type = kind === 'income' ? 'income' : 'expense';
    return this.categories.filter((c) => c.type === type);
  }

  fmt(amount: number, currency: Currency) {
    const symbol = currency === 'NIO' ? 'C$' : '$';
    const sign = amount < 0 ? '-' : '';
    return `${sign}${symbol}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  money(m: Money) {
    if (this.view === 'USD') return this.fmt(m.totalUsd, 'USD');
    if (this.view === 'NIO') return this.fmt(m.totalNio, 'NIO');
    return `${this.fmt(m.totalUsd, 'USD')} · ${this.fmt(m.totalNio, 'NIO')}`;
  }

  /** Headline figure: córdobas in the C$ view, dollars otherwise. */
  primary(m: Money) {
    return this.view === 'NIO' ? this.fmt(m.totalNio, 'NIO') : this.fmt(m.totalUsd, 'USD');
  }

  /** The other currency under a headline, only in the "Both" view. */
  alt(m: Money): string | null {
    return this.view === 'both' ? `≈ ${this.fmt(m.totalNio, 'NIO')}` : null;
  }

  /** The other currency, shown under a native amount. */
  secondary(amount: number, currency: Currency): string | null {
    if (!this.detail) return null;
    const fx = this.detail.fxRate;
    const target: Currency | null =
      this.view === 'both' ? (currency === 'USD' ? 'NIO' : 'USD') : this.view === currency ? null : this.view;
    if (!target) return null;
    return this.fmt(target === 'USD' ? amount / fx : amount * fx, target);
  }

  variance(l: PlanLine) {
    return Math.round(((l.appliedAmount ?? l.plannedAmount) - l.plannedAmount) * 100) / 100;
  }

  outflowProgress() {
    const planned = this.s.expense.planned.totalUsd + this.s.savings.planned.totalUsd;
    const applied = this.s.expense.applied.totalUsd + this.s.savings.applied.totalUsd;
    return planned <= 0 ? 0 : Math.min(100, Math.round((applied / planned) * 100));
  }

  barPct(value: number, row: { planned: Money; actual: Money }) {
    const max = Math.max(row.planned.totalUsd, row.actual.totalUsd);
    return max <= 0 ? 0 : Math.min(100, (value / max) * 100);
  }

  pct(value: number | null) {
    return value === null ? '—' : `${Math.round(value * 100)}%`;
  }

  scoreColor(score: number | null) {
    if (score === null) return 'text-slate-400';
    if (score >= 80) return 'text-emerald-600';
    if (score >= 60) return 'text-amber-600';
    return 'text-rose-600';
  }

  disciplineHelp() {
    const d = this.s.discipline;
    return [
      `On plan: ${this.pct(d.executionRate)} of what was due got applied (50%)`,
      `Accuracy: ${this.pct(d.amountAccuracy)} — how close payments were to the plan (30%)`,
      `Unplanned: ${this.pct(d.unplannedShare)} of real spending was not planned (20%)`,
    ].join('\n');
  }

  statusDot(l: PlanLine) {
    switch (l.status) {
      case 'applied':
        return 'border-emerald-500 bg-emerald-500 text-white';
      case 'skipped':
        return 'border-slate-300 bg-slate-100 text-slate-400';
      case 'carried':
        return 'border-amber-300 bg-amber-50 text-amber-700';
      case 'applying':
        return 'border-sky-400 bg-sky-50 text-sky-600';
      default:
        return l.overdue ? 'border-rose-400 bg-white' : 'border-slate-300 bg-white';
    }
  }

  sourceBadge(l: PlanLine) {
    switch (l.source) {
      case 'loan':
        return { label: 'Loans', cls: 'bg-violet-50 text-violet-700' };
      case 'recurring_expense':
        return { label: 'Recurring', cls: 'bg-sky-50 text-sky-700' };
      case 'subscription':
        return { label: 'Subscription', cls: 'bg-cyan-50 text-cyan-700' };
      case 'planned_income':
        return { label: 'Planned income', cls: 'bg-emerald-50 text-emerald-700' };
      default:
        return { label: 'Manual', cls: 'bg-slate-100 text-slate-600' };
    }
  }

  /** "2026-11-05" -> "Nov 5", without going through time zones. */
  dayLabel(day: string | null | undefined) {
    if (!day) return '';
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  shortPeriod(key?: string) {
    if (!key) return '';
    const [y, m, h] = key.split('-').map(Number);
    const month = new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
    const last = new Date(y, m, 0).getDate();
    return h === 1 ? `${month} 1–15` : `${month} 16–${last}`;
  }

  private inPeriod(day: string) {
    return !!this.detail && day >= this.detail.period.start && day <= this.detail.period.end;
  }

  private todayIso() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Today when it falls in this fortnight; otherwise the nearest edge of it. */
  private defaultDate() {
    const today = this.todayIso();
    if (!this.detail) return today;
    if (today < this.detail.period.start) return this.detail.period.start;
    if (today > this.detail.period.end) return this.detail.period.end;
    return today;
  }

  private defaultAccount(currency: Currency) {
    return this.accounts.find((a) => a.currency === currency)?._id ?? this.accounts[0]?._id ?? '';
  }

  private blankQuick(): QuickAdd {
    return { name: '', amount: null, currency: 'USD', dueDate: '' };
  }

  private apiError(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: string | string[] } })?.error?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string' && message.trim()) return message;
    return fallback;
  }
}
