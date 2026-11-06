import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AccountItem } from '../../core/models/account.model';
import { CategoryItem } from '../../core/models/category.model';
import { Currency, FortnightDetail, Money, PlanLine } from '../../core/models/fortnight-plan.model';
import { FortnightPlansApiService } from '../../core/services/fortnight-plans-api.service';
import { CurrencyView } from './fortnight-trend.component';

type Step = 1 | 2 | 3;

/** How the summary groups the plan. Derived from where each line comes from. */
type GroupKey = 'income' | 'debts' | 'fixed' | 'subscriptions' | 'other' | 'savings';

type Totals = { usd: number; nio: number };

type NewLine = {
  kind: 'income' | 'expense' | 'savings';
  name: string;
  amount: number | null;
  currency: Currency;
  dueDate: string;
  categoryId: string;
  accountId: string;
  toAccountId: string;
  repeat: boolean;
};

const GROUPS: Array<{ key: GroupKey; title: string; hint: string }> = [
  { key: 'income', title: 'Income', hint: 'Planned income for this fortnight' },
  { key: 'debts', title: 'Debts', hint: 'Loan instalments (Loans)' },
  { key: 'fixed', title: 'Fixed expenses', hint: 'Recurring expenses' },
  { key: 'subscriptions', title: 'Subscriptions', hint: 'Subscriptions' },
  { key: 'other', title: 'Other payments', hint: 'Added by hand for this fortnight' },
  { key: 'savings', title: 'Savings & provisions', hint: 'Money set aside' },
];

/**
 * The planning wizard: 1) confirm the income you expect, 2) decide what you
 * will pay, 3) review the whole plan, grouped, and confirm it. Every change is
 * saved as it is made, so leaving half-way loses nothing; confirming only
 * marks the plan as ready to track.
 */
@Component({
  selector: 'app-fortnight-wizard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <!-- STEPPER -->
      <div class="border-b border-slate-100 px-5 py-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">Plan {{ detail.period.label }}</div>
            <div class="text-xs text-slate-500">Everything is saved as you go. Confirm at the end to start tracking.</div>
          </div>
          <button *ngIf="canCancel" (click)="cancelled.emit()" class="text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900">
            Back to tracking
          </button>
        </div>
        <ol class="mt-4 grid grid-cols-3 gap-2 text-xs" aria-label="Planning steps">
          <li *ngFor="let s of steps">
            <button type="button" (click)="goTo(s.n)" [disabled]="!detail.plan || busy"
              class="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left transition disabled:cursor-not-allowed"
              [ngClass]="step === s.n ? 'border-slate-900 bg-slate-900 text-white' : step > s.n ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-white text-slate-500'"
              [attr.aria-current]="step === s.n ? 'step' : null">
              <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
                [ngClass]="step === s.n ? 'border-white' : step > s.n ? 'border-emerald-400' : 'border-slate-300'">
                {{ step > s.n ? '✓' : s.n }}
              </span>
              <span class="truncate font-semibold">{{ s.label }}</span>
            </button>
          </li>
        </ol>
      </div>

      <div *ngIf="error" class="mx-5 mt-4 flex items-start justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800" role="alert">
        <span>{{ error }}</span>
        <button class="text-rose-500 hover:text-rose-700" (click)="error = ''" aria-label="Dismiss">✕</button>
      </div>

      <!-- START -->
      <div *ngIf="!detail.plan" class="px-6 py-12 text-center">
        <div class="text-lg font-semibold text-slate-900">{{ detail.period.label }} is not planned yet</div>
        <p class="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Three steps: confirm the income you expect, choose what you will pay (loans, fixed expenses and subscriptions
          due in these days are suggested), then review the whole plan before confirming it.
        </p>
        <button (click)="start()" [disabled]="busy"
          class="mt-6 rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800 disabled:opacity-50">
          {{ busy ? 'Starting…' : 'Start planning' }}
        </button>
      </div>

      <ng-container *ngIf="detail.plan">
        <!-- STEP 1 · INCOME -->
        <div *ngIf="step === 1" class="px-5 py-5">
          <div class="text-base font-semibold text-slate-900">1 · What do you expect to receive?</div>
          <p class="mt-1 text-sm text-slate-500">
            Planned income due between {{ dayLabel(detail.period.start) }} and {{ dayLabel(detail.period.end) }}. Adjust the
            amount you expect, leave out what will not come, or add another income. You mark it as received later, when it arrives.
          </p>

          <ul class="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-200">
            <ng-container *ngFor="let l of incomeLines(); trackBy: trackLine">
              <ng-container *ngTemplateOutlet="row; context: { $implicit: l }"></ng-container>
            </ng-container>
            <li *ngIf="incomeLines().length === 0" class="px-4 py-6 text-center text-sm text-slate-400">
              No planned income falls in this fortnight. Add what you expect below.
            </li>
          </ul>

          <ng-container *ngTemplateOutlet="addForm; context: { $implicit: 'income' }"></ng-container>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-emerald-50 px-4 py-3">
            <div class="text-sm text-emerald-900">Expected income <span class="font-semibold">{{ primary(s.income.planned) }}</span>
              <span *ngIf="alt(s.income.planned) as a" class="text-emerald-700/70"> · {{ a }}</span></div>
            <button (click)="goTo(2)" [disabled]="busy" class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800 disabled:opacity-50">
              Next: payments →
            </button>
          </div>
        </div>

        <!-- STEP 2 · PAYMENTS -->
        <div *ngIf="step === 2" class="px-5 py-5">
          <div class="text-base font-semibold text-slate-900">2 · What will you pay?</div>
          <p class="mt-1 text-sm text-slate-500">
            Suggested from Loans, Recurring expenses and Subscriptions due in these days. Untick what you will not pay this
            fortnight, adjust amounts, and add everything else you owe or want to set aside.
          </p>

          <div *ngFor="let g of paymentGroups()" class="mt-4">
            <div class="mb-1.5 flex items-end justify-between">
              <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{{ g.title }}</div>
              <div class="text-xs text-slate-500">{{ totalsLabel(groupTotals(g.key)) }}</div>
            </div>
            <ul class="divide-y divide-slate-100 rounded-lg border border-slate-200">
              <ng-container *ngFor="let l of linesOfGroup(g.key, true); trackBy: trackLine">
                <ng-container *ngTemplateOutlet="row; context: { $implicit: l }"></ng-container>
              </ng-container>
            </ul>
          </div>
          <div *ngIf="paymentGroups().length === 0" class="mt-4 rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-400">
            Nothing is scheduled for these days. Add your payments below.
          </div>

          <ng-container *ngTemplateOutlet="addForm; context: { $implicit: 'expense' }"></ng-container>

          <div class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg px-4 py-3"
            [ngClass]="s.available.totalUsd >= 0 ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'">
            <div class="text-sm">
              Income {{ primary(s.income.planned) }} − payments {{ primary(s.expense.planned) }} − savings {{ primary(s.savings.planned) }}
              = <span class="font-semibold">{{ primary(s.available) }}</span> available
            </div>
            <div class="flex gap-2">
              <button (click)="goTo(1)" [disabled]="busy" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50">← Income</button>
              <button (click)="goTo(3)" [disabled]="busy" class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800 disabled:opacity-50">Next: summary →</button>
            </div>
          </div>
        </div>

        <!-- STEP 3 · SUMMARY -->
        <div *ngIf="step === 3" class="px-5 py-5">
          <div class="text-base font-semibold text-slate-900">3 · Your plan for {{ detail.period.label }}</div>

          <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div class="rounded-xl border border-slate-200 p-4">
              <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Income</div>
              <div class="mt-1 text-xl font-semibold text-slate-900">{{ primary(s.income.planned) }}</div>
              <div *ngIf="alt(s.income.planned) as a" class="text-xs text-slate-400">{{ a }}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-4">
              <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Payments</div>
              <div class="mt-1 text-xl font-semibold text-slate-900">{{ primary(s.expense.planned) }}</div>
              <div *ngIf="alt(s.expense.planned) as a" class="text-xs text-slate-400">{{ a }}</div>
            </div>
            <div class="rounded-xl border border-slate-200 p-4">
              <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Savings</div>
              <div class="mt-1 text-xl font-semibold text-slate-900">{{ primary(s.savings.planned) }}</div>
              <div *ngIf="alt(s.savings.planned) as a" class="text-xs text-slate-400">{{ a }}</div>
            </div>
            <div class="rounded-xl border p-4" [ngClass]="s.available.totalUsd >= 0 ? 'border-emerald-200 bg-emerald-50/60' : 'border-rose-200 bg-rose-50/70'">
              <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Available</div>
              <div class="mt-1 text-xl font-semibold" [ngClass]="s.available.totalUsd >= 0 ? 'text-emerald-700' : 'text-rose-700'">{{ primary(s.available) }}</div>
              <div *ngIf="alt(s.available) as a" class="text-xs text-slate-400">{{ a }}</div>
            </div>
          </div>
          <div *ngIf="s.available.totalUsd < 0" class="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-800">
            Payments and savings exceed the income by {{ primary(negate(s.available)) }}. Go back and leave something out, or confirm knowing the gap.
          </div>

          <!-- by type -->
          <div class="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">By type</div>
          <div class="mt-2 overflow-hidden rounded-lg border border-slate-200">
            <ng-container *ngFor="let g of summaryGroups()">
              <div class="flex items-center justify-between bg-slate-50 px-4 py-2">
                <div class="text-sm font-semibold text-slate-900">{{ g.title }} <span class="font-normal text-slate-400">· {{ linesOfGroup(g.key, false).length }}</span></div>
                <div class="text-sm font-semibold" [ngClass]="g.key === 'income' ? 'text-emerald-700' : 'text-slate-900'">{{ totalsLabel(groupTotals(g.key)) }}</div>
              </div>
              <ul class="divide-y divide-slate-100">
                <li *ngFor="let l of linesOfGroup(g.key, false); trackBy: trackLine" class="flex items-center gap-3 px-4 py-2 text-sm">
                  <span class="min-w-0 flex-1 truncate text-slate-800">{{ l.name }}</span>
                  <span class="hidden text-xs text-slate-400 sm:inline">{{ l.categoryName || (l.kind === 'savings' ? 'Savings' : 'Uncategorized') }}</span>
                  <span class="w-16 text-right text-xs text-slate-400">{{ l.dueDay ? dayLabel(l.dueDay) : '—' }}</span>
                  <span class="w-28 text-right font-medium text-slate-900">{{ fmt(l.plannedAmount, l.currency) }}</span>
                </li>
              </ul>
            </ng-container>
          </div>

          <!-- by category -->
          <div class="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Where the money goes, by category</div>
          <div class="mt-2 overflow-hidden rounded-lg border border-slate-200">
            <div *ngFor="let c of categoryRows()" class="flex items-center gap-3 border-b border-slate-100 px-4 py-2 text-sm last:border-b-0">
              <span class="w-40 shrink-0 truncate text-slate-800">{{ c.name }}</span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full bg-slate-700" [style.width.%]="c.share"></div>
              </div>
              <span class="w-10 text-right text-xs text-slate-500">{{ c.share }}%</span>
              <span class="w-36 text-right font-medium text-slate-900">{{ totalsLabel(c.totals) }}</span>
            </div>
            <div *ngIf="categoryRows().length === 0" class="px-4 py-4 text-center text-sm text-slate-400">No payments planned.</div>
          </div>

          <div *ngIf="excludedCount() > 0" class="mt-3 text-xs text-slate-500">
            {{ excludedCount() }} suggested item(s) left out of this fortnight.
          </div>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <button (click)="goTo(2)" [disabled]="busy" class="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-50">← Payments</button>
            <button (click)="confirm()" [disabled]="busy" class="rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-emerald-700 disabled:opacity-50">
              {{ busy ? 'Saving…' : detail.plan.plannedAt ? 'Save plan' : 'Confirm plan' }}
            </button>
          </div>
        </div>
      </ng-container>
    </section>

    <!-- one line, editable while it has not happened yet -->
    <ng-template #row let-l>
      <li class="flex flex-wrap items-center gap-3 px-4 py-3" [ngClass]="{ 'bg-slate-50/70': l.status === 'skipped' }">
        <button type="button" *ngIf="editable(l); else lockedDot" (click)="toggle(l)" [disabled]="busy"
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold transition disabled:opacity-50"
          [ngClass]="l.status === 'planned' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 bg-white text-transparent'"
          [attr.aria-label]="(l.status === 'planned' ? 'Leave out ' : 'Include ') + l.name" [attr.aria-pressed]="l.status === 'planned'">✓</button>
        <ng-template #lockedDot>
          <span class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] text-emerald-700" title="Already done">✓</span>
        </ng-template>

        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="font-medium" [ngClass]="l.status === 'skipped' ? 'text-slate-400 line-through' : 'text-slate-900'">{{ l.name }}</span>
            <span class="rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase" [ngClass]="badge(l).cls">{{ badge(l).label }}</span>
            <span *ngIf="l.carriedFromPeriod" class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Carried over</span>
            <span *ngIf="!editable(l)" class="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{{ l.kind === 'income' ? 'Received' : 'Paid' }}</span>
            <span *ngIf="l.status === 'skipped'" class="text-[10px] font-semibold uppercase text-slate-400">Left out</span>
          </div>
          <div class="mt-0.5 text-xs text-slate-500">
            <span *ngIf="l.dueDay">Due {{ dayLabel(l.dueDay) }}</span>
            <span *ngIf="l.accountName"> · {{ l.kind === 'income' ? 'into' : 'from' }} {{ l.accountName }}</span>
            <span *ngIf="l.toAccountName"> → {{ l.toAccountName }}</span>
            <span *ngIf="l.categoryName"> · {{ l.categoryName }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <ng-container *ngIf="editable(l) && l.status === 'planned'; else staticAmount">
            <span class="text-xs text-slate-400">{{ l.currency === 'NIO' ? 'C$' : '$' }}</span>
            <input type="number" min="0" step="0.01" class="w-28 rounded-lg border border-slate-200 px-2 py-1 text-right text-sm"
              [ngModel]="l.plannedAmount" (change)="setAmount(l, $any($event.target).value)" [disabled]="busy"
              [attr.aria-label]="'Amount for ' + l.name" />
          </ng-container>
          <ng-template #staticAmount>
            <span class="w-32 text-right text-sm font-semibold" [ngClass]="l.status === 'skipped' ? 'text-slate-400' : 'text-slate-900'">
              {{ fmt(l.appliedAmount ?? l.plannedAmount, l.currency) }}
            </span>
          </ng-template>
          <span class="hidden w-24 text-right text-[11px] text-slate-400 sm:inline">{{ secondary(l.plannedAmount, l.currency) }}</span>
          <button *ngIf="l.source === 'manual' && editable(l)" type="button" (click)="remove(l)" [disabled]="busy"
            class="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50" [attr.aria-label]="'Remove ' + l.name">✕</button>
        </div>
      </li>
    </ng-template>

    <!-- add an income or a payment -->
    <ng-template #addForm let-mode>
      <form (ngSubmit)="add()" class="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/60 p-4"
        *ngIf="form.kind === mode || (mode === 'expense' && form.kind === 'savings')">
        <div class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          {{ mode === 'income' ? 'Add another income' : 'Add a payment' }}
        </div>
        <div class="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div *ngIf="mode !== 'income'" class="flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-semibold lg:col-span-2" role="group" aria-label="Type">
            <button type="button" (click)="setKind('expense')" class="flex-1 rounded-md px-2 py-1.5"
              [ngClass]="form.kind === 'expense' ? 'bg-slate-900 text-white' : 'text-slate-500'">Payment / debt</button>
            <button type="button" (click)="setKind('savings')" class="flex-1 rounded-md px-2 py-1.5"
              [ngClass]="form.kind === 'savings' ? 'bg-slate-900 text-white' : 'text-slate-500'">Savings</button>
          </div>
          <input [(ngModel)]="form.name" name="wiz-name" placeholder="{{ mode === 'income' ? 'e.g. Freelance project' : form.kind === 'savings' ? 'e.g. Provision' : 'e.g. Karen, Colegio, Internet' }}"
            class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm" [ngClass]="mode === 'income' ? 'lg:col-span-2' : 'lg:col-span-2'" aria-label="Name" />
          <div class="flex gap-2 lg:col-span-2">
            <input [(ngModel)]="form.amount" name="wiz-amount" type="number" min="0" step="0.01" placeholder="Amount"
              class="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm" aria-label="Amount" />
            <select [(ngModel)]="form.currency" name="wiz-currency" class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" aria-label="Currency">
              <option value="USD">USD</option>
              <option value="NIO">C$</option>
            </select>
          </div>
          <input [(ngModel)]="form.dueDate" name="wiz-date" type="date" [min]="detail.period.start" [max]="detail.period.end"
            class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm" aria-label="Due date" />
          <select [(ngModel)]="form.categoryId" name="wiz-category" class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" aria-label="Category">
            <option value="">Category…</option>
            <option *ngFor="let c of categoriesFor(form.kind)" [value]="c._id">{{ c.name }}</option>
          </select>
          <select [(ngModel)]="form.accountId" name="wiz-account" class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" aria-label="Account">
            <option value="">{{ form.kind === 'income' ? 'Into account…' : 'From account…' }}</option>
            <option *ngFor="let a of accounts" [value]="a._id">{{ a.name }} ({{ a.currency }})</option>
          </select>
          <select *ngIf="form.kind === 'savings'" [(ngModel)]="form.toAccountId" name="wiz-to" class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm" aria-label="Savings account">
            <option value="">To account…</option>
            <option *ngFor="let a of accounts" [value]="a._id">{{ a.name }} ({{ a.currency }})</option>
          </select>
          <label *ngIf="form.kind !== 'income'" class="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" [(ngModel)]="form.repeat" name="wiz-repeat" /> Every fortnight
          </label>
          <button type="submit" [disabled]="busy || !form.name.trim() || !form.amount"
            class="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-slate-800 disabled:opacity-40">
            Add
          </button>
        </div>
      </form>
    </ng-template>
  `,
})
export class FortnightWizardComponent implements OnChanges {
  @Input({ required: true }) detail!: FortnightDetail;
  @Input() accounts: AccountItem[] = [];
  @Input() categories: CategoryItem[] = [];
  @Input() view: CurrencyView = 'both';
  /** Editing a plan that was already confirmed: offer a way back to tracking. */
  @Input() canCancel = false;
  @Output() detailChange = new EventEmitter<FortnightDetail>();
  @Output() finished = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  readonly steps: Array<{ n: Step; label: string }> = [
    { n: 1, label: 'Income' },
    { n: 2, label: 'Payments' },
    { n: 3, label: 'Summary' },
  ];

  step: Step = 1;
  busy = false;
  error = '';
  form: NewLine = this.blank('income');

  constructor(private readonly api: FortnightPlansApiService) {}

  ngOnChanges() {
    if (!this.detail.plan) this.step = 1;
  }

  get s() {
    return this.detail.summary!;
  }

  // ------------------------------------------------------------ navigation

  goTo(step: Step) {
    if (!this.detail.plan) return;
    this.step = step;
    this.error = '';
    this.form = this.blank(step === 1 ? 'income' : 'expense');
  }

  start() {
    this.run(this.api.open(this.detail.period.key), () => (this.step = 1), 'Could not start the fortnight.');
  }

  confirm() {
    this.run(this.api.confirm(this.detail.period.key), () => this.finished.emit(), 'Could not confirm the plan.');
  }

  // --------------------------------------------------------------- editing

  editable(l: PlanLine) {
    return l.status === 'planned' || l.status === 'skipped';
  }

  toggle(l: PlanLine) {
    const key = this.detail.period.key;
    this.run(l.status === 'planned' ? this.api.skip(key, l._id) : this.api.restore(key, l._id));
  }

  setAmount(l: PlanLine, raw: string) {
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      this.error = 'Enter an amount of zero or more.';
      return;
    }
    if (Math.round(amount * 100) === Math.round(l.plannedAmount * 100)) return;
    this.run(this.api.updateLine(this.detail.period.key, l._id, { plannedAmount: amount }));
  }

  remove(l: PlanLine) {
    this.run(this.api.removeLine(this.detail.period.key, l._id));
  }

  setKind(kind: 'expense' | 'savings') {
    this.form.kind = kind;
    this.form.categoryId = '';
    if (kind !== 'savings') this.form.toAccountId = '';
  }

  add() {
    const f = this.form;
    if (!f.name.trim() || !f.amount || f.amount <= 0) {
      this.error = 'Give it a name and an amount greater than zero.';
      return;
    }
    const kind = f.kind;
    this.run(
      this.api.addLine(this.detail.period.key, {
        kind,
        name: f.name.trim(),
        plannedAmount: f.amount,
        currency: f.currency,
        dueDate: f.dueDate || undefined,
        categoryId: f.categoryId || undefined,
        accountId: f.accountId || undefined,
        toAccountId: kind === 'savings' && f.toAccountId ? f.toAccountId : undefined,
        repeat: kind !== 'income' ? f.repeat : undefined,
      }),
      () => (this.form = this.blank(kind)),
      'Could not add it.',
    );
  }

  // ---------------------------------------------------------------- reading

  private lines() {
    return this.detail.plan?.lines ?? [];
  }

  /** Lines that belong in this fortnight (moved-out and unplanned spending are not part of the plan). */
  private planLines() {
    return this.lines().filter((l) => !l.unplanned && l.status !== 'carried');
  }

  incomeLines() {
    return this.planLines().filter((l) => l.kind === 'income');
  }

  groupOf(l: PlanLine): GroupKey {
    if (l.kind === 'income') return 'income';
    if (l.kind === 'savings') return 'savings';
    if (l.source === 'loan') return 'debts';
    if (l.source === 'recurring_expense') return 'fixed';
    if (l.source === 'subscription') return 'subscriptions';
    return 'other';
  }

  /** includeLeftOut: the payments step shows unticked suggestions; the summary does not. */
  linesOfGroup(key: GroupKey, includeLeftOut: boolean) {
    return this.planLines().filter(
      (l) => this.groupOf(l) === key && (includeLeftOut || l.status !== 'skipped'),
    );
  }

  paymentGroups() {
    return GROUPS.filter((g) => g.key !== 'income' && this.linesOfGroup(g.key, true).length > 0);
  }

  summaryGroups() {
    return GROUPS.filter((g) => this.linesOfGroup(g.key, false).length > 0);
  }

  groupTotals(key: GroupKey): Totals {
    return this.sum(this.linesOfGroup(key, false));
  }

  categoryRows() {
    const outflows = this.planLines().filter((l) => l.kind !== 'income' && l.status !== 'skipped');
    const byName = new Map<string, PlanLine[]>();
    for (const l of outflows) {
      const name = l.categoryName || (l.kind === 'savings' ? 'Savings' : 'Uncategorized');
      byName.set(name, [...(byName.get(name) ?? []), l]);
    }
    const total = this.sum(outflows).usd;
    return Array.from(byName.entries())
      .map(([name, items]) => {
        const totals = this.sum(items);
        return { name, totals, share: total > 0 ? Math.round((totals.usd / total) * 100) : 0 };
      })
      .sort((a, b) => b.totals.usd - a.totals.usd);
  }

  excludedCount() {
    return this.planLines().filter((l) => l.status === 'skipped').length;
  }

  categoriesFor(kind: NewLine['kind']) {
    const type = kind === 'income' ? 'income' : 'expense';
    return this.categories.filter((c) => c.type === type);
  }

  trackLine(_: number, l: PlanLine) {
    return l._id;
  }

  // ------------------------------------------------------------- formatting

  private sum(lines: PlanLine[]): Totals {
    const fx = this.detail.fxRate;
    let usd = 0;
    for (const l of lines) {
      usd += l.currency === 'USD' ? l.plannedAmount : l.plannedAmount / fx;
    }
    return { usd: Math.round(usd * 100) / 100, nio: Math.round(usd * fx * 100) / 100 };
  }

  totalsLabel(t: Totals) {
    if (this.view === 'USD') return this.fmt(t.usd, 'USD');
    if (this.view === 'NIO') return this.fmt(t.nio, 'NIO');
    return `${this.fmt(t.usd, 'USD')} · ${this.fmt(t.nio, 'NIO')}`;
  }

  primary(m: Money) {
    return this.view === 'NIO' ? this.fmt(m.totalNio, 'NIO') : this.fmt(m.totalUsd, 'USD');
  }

  alt(m: Money): string | null {
    return this.view === 'both' ? `≈ ${this.fmt(m.totalNio, 'NIO')}` : null;
  }

  negate(m: Money): Money {
    return { USD: -m.USD, NIO: -m.NIO, totalUsd: -m.totalUsd, totalNio: -m.totalNio };
  }

  secondary(amount: number, currency: Currency): string {
    const fx = this.detail.fxRate;
    const target: Currency | null =
      this.view === 'both' ? (currency === 'USD' ? 'NIO' : 'USD') : this.view === currency ? null : this.view;
    if (!target) return '';
    return `≈ ${this.fmt(target === 'USD' ? amount / fx : amount * fx, target)}`;
  }

  fmt(amount: number, currency: Currency) {
    const symbol = currency === 'NIO' ? 'C$' : '$';
    const sign = amount < 0 ? '-' : '';
    return `${sign}${symbol}${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  dayLabel(day: string | null | undefined) {
    if (!day) return '';
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  badge(l: PlanLine) {
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
        return { label: l.kind === 'savings' ? 'Savings' : 'Added', cls: 'bg-slate-100 text-slate-600' };
    }
  }

  // ---------------------------------------------------------------- plumbing

  private blank(kind: NewLine['kind']): NewLine {
    return { kind, name: '', amount: null, currency: 'USD', dueDate: '', categoryId: '', accountId: '', toAccountId: '', repeat: false };
  }

  private run(request: Observable<FortnightDetail>, onDone?: () => void, fallback = 'That did not work.') {
    this.busy = true;
    this.error = '';
    request.subscribe({
      next: (detail) => {
        this.busy = false;
        this.detailChange.emit(detail);
        onDone?.();
      },
      error: (err) => {
        this.busy = false;
        const message = (err as { error?: { message?: string | string[] } })?.error?.message;
        this.error = Array.isArray(message) ? message.join('. ') : typeof message === 'string' && message.trim() ? message : fallback;
      },
    });
  }
}
