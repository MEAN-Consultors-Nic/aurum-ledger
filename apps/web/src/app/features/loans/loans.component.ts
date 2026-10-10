import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountsApiService } from '../../core/services/accounts-api.service';
import { CategoriesApiService } from '../../core/services/categories-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { SettingsApiService } from '../../core/services/settings-api.service';
import { LoansApiService } from '../../core/services/loans-api.service';
import {
  LoanItem,
  LoanKind,
  LoanPayload,
  LoanPaymentOccurrence,
  LoanSchedule,
  LoanScheduleRow,
  LoanScheduleType,
} from '../../core/models/loan.model';
import { AccountItem } from '../../core/models/account.model';
import { CategoryItem } from '../../core/models/category.model';
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';

@Component({
  selector: 'app-loans',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ActionMenuComponent],
  template: `
    <div class="space-y-6">
      <!-- HERO -->
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-slate-900">Loans</div>
          <div class="mt-1 text-sm text-slate-500">
            Debt obligations — installments scheduled per month. Track principal, payments and remaining balance.
          </div>
        </div>
        <div class="flex items-center gap-2">
          <input
            type="month"
            [(ngModel)]="selectedMonth"
            (ngModelChange)="loadMonth()"
            class="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <button
            (click)="openCreate()"
            class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white"
          >
            + Add loan
          </button>
        </div>
      </header>

      <div
        *ngIf="actionError"
        class="flex items-start justify-between gap-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        <span>{{ actionError }}</span>
        <button type="button" class="text-red-400 hover:text-red-600" (click)="actionError = ''">X</button>
      </div>

      <!-- ALERT BANNER -->
      <div
        *ngIf="overdueCount() > 0"
        class="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3"
      >
        <div class="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-sm font-bold text-rose-700">!</div>
        <div class="flex-1">
          <div class="text-sm font-semibold text-rose-900">
            {{ overdueCount() }} loan payment{{ overdueCount() === 1 ? '' : 's' }} overdue
          </div>
          <div class="text-xs text-rose-800">
            Confirm what was paid or omit if it didn't go through.
          </div>
        </div>
      </div>

      <!-- MONTH OVERVIEW -->
      <section class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="grid gap-6 md:grid-cols-2">
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {{ monthLabel() }} · {{ activeLoanCount() }} active {{ activeLoanCount() === 1 ? 'loan' : 'loans' }}
            </div>
            <div class="mt-2 text-3xl font-semibold text-slate-900">
              {{ formatMoney(totalByCurrency('USD', 'planned'), 'USD') }}
            </div>
            <div class="text-sm text-slate-500">
              + {{ formatMoney(totalByCurrency('NIO', 'planned'), 'NIO') }} due this month
            </div>
          </div>
          <div class="md:text-right">
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Paid so far</div>
            <div class="mt-2 text-3xl font-semibold text-emerald-700">
              {{ formatMoney(totalByCurrency('USD', 'confirmed'), 'USD') }}
            </div>
            <div class="text-sm text-slate-500">
              + {{ formatMoney(totalByCurrency('NIO', 'confirmed'), 'NIO') }} paid
            </div>
          </div>
        </div>

        <div class="mt-6">
          <div class="flex items-center justify-between text-xs text-slate-600">
            <span>
              {{ confirmationProgress().confirmed }} of {{ confirmationProgress().total }} installments paid
            </span>
            <span class="font-semibold text-slate-900">{{ confirmationProgress().percent }}%</span>
          </div>
          <div class="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              class="h-full bg-emerald-500 transition-all"
              [style.width.%]="confirmationProgress().percent"
            ></div>
          </div>
        </div>

        <div class="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
          <div>
            Owed now (USD): <span class="font-semibold text-slate-900">{{ formatMoney(totalOutstanding('USD'), 'USD') }}</span>
          </div>
          <div class="md:text-right">
            Owed now (NIO): <span class="font-semibold text-slate-900">{{ formatMoney(totalOutstanding('NIO'), 'NIO') }}</span>
          </div>
        </div>
      </section>

      <!-- SCHEDULE -->
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="border-b border-slate-100 px-5 py-4">
          <div class="text-sm font-semibold text-slate-900">Payment schedule</div>
          <div class="text-xs text-slate-500">
            Confirm each installment when paid, omit if it won't happen.
          </div>
        </div>

        <ng-container *ngIf="grouped().overdue.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 bg-rose-50/40 px-5 py-2">
            <span class="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">Overdue</span>
            <span class="text-xs text-slate-500">{{ grouped().overdue.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().overdue" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="font-medium text-slate-900">{{ resolveLoanName(o) }}</span>
                  <span class="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                    {{ daysOverdue(o.date) }}d overdue
                  </span>
                </div>
                <div class="text-xs text-slate-500">Due {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}</div>
              </div>
              <div class="font-semibold text-slate-900">{{ formatMoney(o.amount, o.currency) }}</div>
              <div class="flex items-center gap-2">
                <button (click)="confirm(o)" [disabled]="isWorking"
                  class="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-emerald-700 disabled:opacity-50">
                  Confirm
                </button>
                <button (click)="omit(o)" [disabled]="isWorking"
                  class="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">
                  Omit
                </button>
              </div>
            </li>
          </ul>
        </ng-container>

        <ng-container *ngIf="grouped().thisWeek.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 bg-amber-50/40 px-5 py-2">
            <span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">This week</span>
            <span class="text-xs text-slate-500">{{ grouped().thisWeek.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().thisWeek" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="min-w-0 flex-1">
                <div class="font-medium text-slate-900">{{ resolveLoanName(o) }}</div>
                <div class="text-xs text-slate-500">Due {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}</div>
              </div>
              <div class="font-semibold text-slate-900">{{ formatMoney(o.amount, o.currency) }}</div>
              <div class="flex items-center gap-2">
                <button (click)="confirm(o)" [disabled]="isWorking"
                  class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-50">
                  Confirm
                </button>
                <button (click)="omit(o)" [disabled]="isWorking"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600 transition hover:bg-slate-50 disabled:opacity-50">
                  Omit
                </button>
              </div>
            </li>
          </ul>
        </ng-container>

        <ng-container *ngIf="grouped().later.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 px-5 py-2">
            <span class="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-700">Later this month</span>
            <span class="text-xs text-slate-500">{{ grouped().later.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().later" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="min-w-0 flex-1">
                <div class="font-medium text-slate-900">{{ resolveLoanName(o) }}</div>
                <div class="text-xs text-slate-500">Due {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}</div>
              </div>
              <div class="font-semibold text-slate-900">{{ formatMoney(o.amount, o.currency) }}</div>
              <div class="flex items-center gap-2">
                <button (click)="confirm(o)" [disabled]="isWorking"
                  class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">
                  Confirm
                </button>
                <button (click)="omit(o)" [disabled]="isWorking"
                  class="rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700 disabled:opacity-50">
                  Omit
                </button>
              </div>
            </li>
          </ul>
        </ng-container>

        <ng-container *ngIf="grouped().confirmed.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 bg-emerald-50/40 px-5 py-2">
            <span class="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">Paid</span>
            <span class="text-xs text-slate-500">{{ grouped().confirmed.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().confirmed" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="flex min-w-0 flex-1 items-center gap-2">
                <span class="text-emerald-600">✓</span>
                <div class="min-w-0">
                  <div class="font-medium text-slate-900">{{ resolveLoanName(o) }}</div>
                  <div class="text-xs text-slate-500">Paid {{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}</div>
                </div>
              </div>
              <div class="font-semibold text-emerald-700">{{ formatMoney(o.amount, o.currency) }}</div>
            </li>
          </ul>
        </ng-container>

        <ng-container *ngIf="grouped().omitted.length > 0">
          <div class="flex items-center gap-2 border-t border-slate-100 px-5 py-2">
            <span class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">Omitted</span>
            <span class="text-xs text-slate-500">{{ grouped().omitted.length }}</span>
          </div>
          <ul class="divide-y divide-slate-100">
            <li *ngFor="let o of grouped().omitted" class="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div class="min-w-0 flex-1 text-slate-400">
                <div class="line-through">{{ resolveLoanName(o) }}</div>
                <div class="text-xs">{{ formatShortDate(o.date) }} · {{ resolveAccountName(o) }}</div>
              </div>
              <div class="text-slate-400 line-through">{{ formatMoney(o.amount, o.currency) }}</div>
              <button
                (click)="reactivate(o)"
                [disabled]="isWorking"
                class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Reactivate
              </button>
            </li>
          </ul>
        </ng-container>

        <div *ngIf="occurrences.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
          No scheduled payments this month.
        </div>
      </section>

      <!-- LOANS LIST -->
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div class="text-sm font-semibold text-slate-900">Loans</div>
            <div class="text-xs text-slate-500">
              All loan definitions and their installment schedules.
            </div>
          </div>
          <button
            (click)="openCreate()"
            class="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
          >
            + Add loan
          </button>
        </div>

        <div *ngIf="loans.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
          No loans yet. Add one to start tracking installments.
        </div>

        <ul *ngIf="loans.length > 0" class="divide-y divide-slate-100">
          <li *ngFor="let s of loans" class="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto_auto]">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium text-slate-900">{{ s.name }}</span>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  [ngClass]="s.kind === 'interest_bearing' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'">
                  {{ s.kind === 'interest_bearing' ? s.interestRatePercent + '% ' + periodWord(s) : 'Fixed instalment' }}
                </span>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  [ngClass]="statusClass(s)">
                  {{ s.status === 'settled' ? 'Settled' : s.isActive ? 'Active' : 'Inactive' }}
                </span>
              </div>
              <div class="mt-1 text-xs text-slate-500">{{ resolveAccountName(s) }} · {{ scheduleLabel(s) }}</div>
              <div class="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-slate-100">
                <div class="h-full bg-emerald-500 transition-all" [style.width.%]="s.progressPercent"></div>
              </div>
              <div class="mt-1 text-[11px] text-slate-500">
                {{ formatMoney(s.principalPaidTotal, s.currency) }} of
                {{ formatMoney(s.principal, s.currency) }} capital repaid
                <span *ngIf="s.interestPaidTotal > 0">
                  · {{ formatMoney(s.interestPaidTotal, s.currency) }} paid in interest
                </span>
              </div>
            </div>
            <div class="text-right md:min-w-32">
              <div class="text-[10px] uppercase tracking-wide text-slate-400">Balance owed</div>
              <div class="text-sm font-semibold text-slate-900">{{ formatMoney(s.currentBalance, s.currency) }}</div>
            </div>
            <div class="text-right md:min-w-32">
              <div class="text-[10px] uppercase tracking-wide text-slate-400">
                {{ s.kind === 'interest_bearing' ? 'Next interest' : 'Instalment' }}
              </div>
              <div class="text-sm font-semibold text-slate-900">
                {{ formatMoney(s.kind === 'interest_bearing' ? s.nextInterestDue : s.installmentAmount, s.currency) }}
              </div>
              <div *ngIf="s.remainingInstallments" class="text-[11px] text-slate-500">
                {{ s.remainingInstallments }} left
              </div>
            </div>
            <app-action-menu [items]="sourceActions(s)" />
          </li>
        </ul>
      </section>
    </div>

    <!-- NEW / EDIT LOAN — WIZARD -->
    <div
      *ngIf="isModalOpen"
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-8"
    >
      <div class="w-full max-w-2xl rounded-2xl bg-white shadow-xl">
        <!-- header -->
        <div class="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <div class="text-lg font-semibold text-slate-900">
              {{ editing ? 'Edit debt' : 'New debt' }}
            </div>
            <div class="text-sm text-slate-500">{{ stepSubtitle }}</div>
          </div>
          <button class="text-slate-400 transition hover:text-slate-600" (click)="closeModal()">✕</button>
        </div>

        <!-- stepper -->
        <div class="flex items-center gap-2 border-b border-slate-100 px-6 py-4">
          <ng-container *ngFor="let label of stepLabels; let i = index">
            <button
              type="button"
              (click)="goToStep(i + 1)"
              class="flex items-center gap-2 rounded-lg px-2 py-1 transition"
              [ngClass]="i + 1 <= step ? 'text-slate-900' : 'text-slate-400'"
            >
              <span
                class="inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold"
                [ngClass]="i + 1 < step
                  ? 'bg-emerald-500 text-white'
                  : i + 1 === step
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-400'"
              >
                {{ i + 1 < step ? '✓' : i + 1 }}
              </span>
              <span class="hidden text-xs font-semibold uppercase tracking-wide sm:block">{{ label }}</span>
            </button>
            <div *ngIf="i < stepLabels.length - 1" class="h-px flex-1"
                 [ngClass]="i + 1 < step ? 'bg-emerald-300' : 'bg-slate-200'"></div>
          </ng-container>
        </div>

        <form [formGroup]="form" (ngSubmit)="save()" class="px-6 py-6">
          <!-- ======================= STEP 1 ======================= -->
          <div *ngIf="step === 1" class="space-y-6">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
                What kind of debt is it?
              </label>
              <div class="mt-2 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  (click)="setKind('fixed_installment')"
                  class="rounded-xl border-2 p-4 text-left transition"
                  [ngClass]="form.value.kind === 'fixed_installment'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'"
                >
                  <div class="text-sm font-semibold text-slate-900">Fixed instalment</div>
                  <div class="mt-1 text-xs leading-relaxed text-slate-500">
                    Commercial credit. The same amount every period, no interest, and it ends on a known date.
                  </div>
                </button>
                <button
                  type="button"
                  (click)="setKind('interest_bearing')"
                  class="rounded-xl border-2 p-4 text-left transition"
                  [ngClass]="form.value.kind === 'interest_bearing'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'"
                >
                  <div class="text-sm font-semibold text-slate-900">Interest on the balance</div>
                  <div class="mt-1 text-xs leading-relaxed text-slate-500">
                    A rate per period on what you still owe. You pay what you decide; interest first, the rest cuts capital.
                  </div>
                </button>
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
              <input
                formControlName="name"
                placeholder="Credito Cama + TV"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
              />
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Currency of the debt
              </label>
              <div class="mt-2 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  (click)="setCurrency('USD')"
                  class="rounded-md px-5 py-1.5 text-sm font-semibold transition"
                  [ngClass]="form.value.currency === 'USD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'"
                >
                  USD
                </button>
                <button
                  type="button"
                  (click)="setCurrency('NIO')"
                  class="rounded-md px-5 py-1.5 text-sm font-semibold transition"
                  [ngClass]="form.value.currency === 'NIO' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'"
                >
                  NIO (C$)
                </button>
              </div>
              <div class="mt-2 text-[11px] text-slate-500">
                What the debt is denominated in. You choose which account pays it in the next step — it can be in
                the other currency.
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  {{ form.value.kind === 'interest_bearing' ? 'Amount borrowed' : 'Total of the credit' }}
                </label>
                <div class="relative mt-2">
                  <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {{ symbol(form.value.currency) }}
                  </span>
                  <input
                    formControlName="principal"
                    type="number"
                    step="0.01"
                    class="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-slate-900"
                  />
                </div>
              </div>

              <div *ngIf="form.value.kind === 'fixed_installment'">
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Amount per payment
                </label>
                <div class="relative mt-2">
                  <span class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">
                    {{ symbol(form.value.currency) }}
                  </span>
                  <input
                    formControlName="installmentAmount"
                    type="number"
                    step="0.01"
                    class="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-slate-900"
                  />
                </div>
              </div>

              <div *ngIf="form.value.kind === 'interest_bearing'">
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Rate per period
                </label>
                <div class="relative mt-2">
                  <input
                    formControlName="interestRatePercent"
                    type="number"
                    step="0.01"
                    class="w-full rounded-lg border border-slate-200 py-2.5 pl-3 pr-9 text-sm outline-none transition focus:border-slate-900"
                  />
                  <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">%</span>
                </div>
              </div>
            </div>

            <div
              *ngIf="form.value.kind === 'interest_bearing'"
              class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900"
            >
              {{ interestPreview }}
            </div>

            <div *ngIf="form.value.kind === 'fixed_installment'">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
                Number of payments <span class="text-slate-400">(optional)</span>
              </label>
              <input
                formControlName="totalInstallments"
                type="number"
                min="1"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900 sm:w-40"
              />
              <div class="mt-1 text-[11px] text-slate-500">
                Leave it empty and it runs until the balance reaches zero.
              </div>
            </div>
          </div>

          <!-- ======================= STEP 2 ======================= -->
          <div *ngIf="step === 2" class="space-y-6">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">How often?</label>
              <div class="mt-2 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  (click)="setScheduleType('monthly_days')"
                  class="rounded-xl border-2 p-4 text-left transition"
                  [ngClass]="form.value.scheduleType === 'monthly_days'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'"
                >
                  <div class="text-sm font-semibold text-slate-900">Days of the month</div>
                  <div class="mt-1 text-xs text-slate-500">The 15th and the 30th, or just the 1st.</div>
                </button>
                <button
                  type="button"
                  (click)="setScheduleType('interval_days')"
                  class="rounded-xl border-2 p-4 text-left transition"
                  [ngClass]="form.value.scheduleType === 'interval_days'
                    ? 'border-slate-900 bg-slate-50'
                    : 'border-slate-200 hover:border-slate-300'"
                >
                  <div class="text-sm font-semibold text-slate-900">Every N days</div>
                  <div class="mt-1 text-xs text-slate-500">Weekly, fortnightly, or any interval you set.</div>
                </button>
              </div>
            </div>

            <div *ngIf="form.value.scheduleType === 'monthly_days'">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Which days</label>
              <input
                formControlName="daysOfMonth"
                placeholder="15, 30"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900 sm:w-48"
              />
              <div class="mt-2 flex flex-wrap gap-2">
                <button type="button" class="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" (click)="setDays('1')">1st</button>
                <button type="button" class="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" (click)="setDays('15')">15th</button>
                <button type="button" class="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" (click)="setDays('15, 30')">15th and 30th</button>
              </div>
              <div class="mt-2 text-[11px] text-slate-500">Day 30 lands on the last day of shorter months.</div>
            </div>

            <div *ngIf="form.value.scheduleType === 'interval_days'" class="space-y-4">
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Every how many days</label>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    formControlName="intervalDays"
                    type="number"
                    min="1"
                    class="w-24 rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                  />
                  <span class="text-sm text-slate-500">days</span>
                  <button type="button" class="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" (click)="setInterval(7)">Weekly</button>
                  <button type="button" class="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" (click)="setInterval(14)">Fortnightly</button>
                  <button type="button" class="rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" (click)="setInterval(30)">Every 30 days</button>
                </div>
              </div>
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">First payment</label>
                <input
                  formControlName="startDate"
                  type="date"
                  class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900 sm:w-56"
                />
                <div class="mt-1 text-[11px] text-slate-500">Every later payment counts from this date.</div>
              </div>
            </div>

            <div class="rounded-lg bg-slate-50 px-4 py-3 text-[11px] text-slate-600">{{ cadenceSummary }}</div>
          </div>

          <!-- ======================= STEP 3 ======================= -->
          <div *ngIf="step === 3" class="space-y-6">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Paid from</label>
                <select
                  formControlName="accountId"
                  class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                >
                  <option value="">Select account</option>
                  <option *ngFor="let account of accounts" [value]="account._id">
                    {{ account.name }} ({{ account.currency }})
                  </option>
                </select>
              </div>
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Category</label>
                <select
                  formControlName="categoryId"
                  class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
                >
                  <option value="">Select category</option>
                  <option *ngFor="let category of categories" [value]="category._id">{{ category.name }}</option>
                </select>
              </div>
            </div>

            <div
              *ngIf="isCrossCurrency"
              class="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[11px] leading-relaxed text-sky-900"
            >
              {{ conversionHint }}
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Notes</label>
              <textarea
                formControlName="notes"
                rows="2"
                class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-slate-900"
              ></textarea>
            </div>

            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" formControlName="isActive" class="rounded" />
              Active
            </label>

            <!-- review -->
            <div class="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Review</div>
              <dl class="mt-3 space-y-2 text-sm">
                <div class="flex justify-between gap-4">
                  <dt class="text-slate-500">Debt</dt>
                  <dd class="text-right font-medium text-slate-900">{{ reviewDebt }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-slate-500">Payments</dt>
                  <dd class="text-right font-medium text-slate-900">{{ reviewPayments }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-slate-500">Charged to</dt>
                  <dd class="text-right font-medium text-slate-900">{{ reviewAccount }}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div *ngIf="error" class="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{{ error }}</div>

          <!-- footer -->
          <div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-5">
            <button
              type="button"
              class="text-sm font-medium text-slate-500 transition hover:text-slate-700"
              (click)="step === 1 ? closeModal() : back()"
            >
              {{ step === 1 ? 'Cancel' : 'Back' }}
            </button>

            <div class="flex items-center gap-3">
              <span class="text-[11px] text-slate-400">Step {{ step }} of {{ stepLabels.length }}</span>
              <button
                *ngIf="step < stepLabels.length"
                type="button"
                (click)="next()"
                [disabled]="!canContinue()"
                class="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-40"
              >
                Continue
              </button>
              <button
                *ngIf="step === stepLabels.length"
                type="submit"
                [disabled]="!canContinue() || isSaving"
                class="rounded-lg bg-slate-900 px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-800 disabled:opacity-40"
              >
                {{ isSaving ? 'Saving...' : editing ? 'Save changes' : 'Create debt' }}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>


    <!-- PAYMENT MODAL -->
    <div
      *ngIf="payment"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold">Record payment</div>
          <button class="text-slate-400" (click)="payment = null">X</button>
        </div>

        <div class="mt-1 text-sm text-slate-500">
          {{ resolveLoanName(payment.occurrence) }} · due {{ formatShortDate(payment.occurrence.date) }}
        </div>

        <div *ngIf="payment.loan?.kind === 'interest_bearing'" class="mt-4 rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <div class="flex justify-between">
            <span class="text-slate-500">Balance owed</span>
            <span class="font-semibold text-slate-900">
              {{ formatMoney(payment.loan!.currentBalance, payment.occurrence.currency) }}
            </span>
          </div>
          <div class="mt-1 flex justify-between">
            <span class="text-slate-500">
              Interest this period ({{ payment.loan!.interestRatePercent }}%)
            </span>
            <span class="font-semibold text-slate-900">
              {{ formatMoney(payment.loan!.nextInterestDue, payment.occurrence.currency) }}
            </span>
          </div>
        </div>

        <div class="mt-4">
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Amount paid</label>
          <input
            type="number"
            step="0.01"
            [(ngModel)]="payment.amount"
            class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>

        <div
          *ngIf="payment.loan?.crossCurrency"
          class="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-[11px] leading-relaxed text-sky-900"
        >
          Debt in {{ payment.occurrence.currency }}, paid from a {{ payment.loan!.accountCurrency }} account.
          {{ symbol(payment.occurrence.currency) }}{{ (payment.amount || 0).toFixed(2) }} leaves the account as
          {{ symbol(payment.loan!.accountCurrency) }}{{ accountChargeForPayment().toFixed(2) }}
          at the global rate of {{ payment.loan!.exchangeRate }}.
        </div>

        <div class="mt-3 rounded-lg border border-slate-200 px-4 py-3 text-sm">
          <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-400">This payment</div>
          <div class="mt-2 flex justify-between">
            <span class="text-slate-500">Interest</span>
            <span class="text-slate-900">{{ formatMoney(paymentSplit().interest, payment.occurrence.currency) }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-500">Capital</span>
            <span class="text-slate-900">{{ formatMoney(paymentSplit().principal, payment.occurrence.currency) }}</span>
          </div>
          <div *ngIf="paymentSplit().capitalized > 0" class="flex justify-between text-amber-700">
            <span>Unpaid interest added to the balance</span>
            <span>{{ formatMoney(paymentSplit().capitalized, payment.occurrence.currency) }}</span>
          </div>
          <div class="mt-2 flex justify-between border-t border-slate-100 pt-2 font-semibold">
            <span class="text-slate-500">Balance after</span>
            <span class="text-slate-900">{{ formatMoney(paymentSplit().balanceAfter, payment.occurrence.currency) }}</span>
          </div>
        </div>

        <div *ngIf="paymentSplit().capitalized > 0" class="mt-2 text-[11px] text-amber-700">
          This is less than the interest for the period, so the shortfall is added to the capital and will
          itself earn interest.
        </div>

        <div *ngIf="actionError" class="mt-3 text-sm text-red-600">{{ actionError }}</div>

        <div class="mt-5 flex justify-end gap-3">
          <button type="button" class="text-sm text-slate-500" (click)="payment = null">Cancel</button>
          <button
            type="button"
            (click)="submitPayment()"
            [disabled]="isWorking || !payment.amount"
            class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-50"
          >
            {{ isWorking ? 'Saving...' : 'Record payment' }}
          </button>
        </div>
      </div>
    </div>

    <!-- SCHEDULE MODAL -->
    <div
      *ngIf="schedule"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-8"
    >
      <div class="flex max-h-full w-full max-w-3xl flex-col rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-lg font-semibold">{{ schedule.loan.name }}</div>
            <div class="text-sm text-slate-500">
              {{ formatMoney(schedule.loan.currentBalance, schedule.loan.currency) }} owed ·
              {{ formatMoney(schedule.loan.interestPaidTotal, schedule.loan.currency) }} paid in interest
            </div>
          </div>
          <button class="text-slate-400" (click)="schedule = null">X</button>
        </div>

        <div
          *ngIf="schedule.projectionIsSimulation"
          class="mt-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3"
        >
          <div class="flex-1 text-[11px] text-amber-900">{{ schedule.projectionNote }}</div>
          <div class="flex items-center gap-2">
            <span class="text-[11px] font-semibold text-amber-900">Simulate</span>
            <input
              type="number"
              step="0.01"
              [(ngModel)]="projectionPayment"
              (ngModelChange)="reloadSchedule()"
              class="w-28 rounded-lg border border-amber-200 px-2 py-1 text-sm"
            />
            <span class="text-[11px] text-amber-900">per period</span>
          </div>
        </div>

        <div class="mt-4 min-h-0 flex-1 overflow-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-white text-[10px] uppercase tracking-wide text-slate-400">
              <tr class="border-b border-slate-100">
                <th class="py-2 text-left">#</th>
                <th class="py-2 text-left">Date</th>
                <th class="py-2 text-right">Paid</th>
                <th class="py-2 text-right">Interest</th>
                <th class="py-2 text-right">Capital</th>
                <th class="py-2 text-right">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of scheduleRows()" class="border-b border-slate-50"
                  [ngClass]="row.actual ? '' : 'text-slate-400'">
                <td class="py-2">{{ row.sequence }}</td>
                <td class="py-2">
                  {{ formatShortDate(row.date) }}
                  <span *ngIf="row.status === 'omitted'" class="ml-1 text-[10px] font-semibold uppercase text-rose-600">omitted</span>
                  <span *ngIf="!row.actual" class="ml-1 text-[10px] font-semibold uppercase">projected</span>
                </td>
                <td class="py-2 text-right">{{ row.paid.toFixed(2) }}</td>
                <td class="py-2 text-right">
                  {{ row.interest.toFixed(2) }}
                  <span *ngIf="row.capitalized > 0" class="text-[10px] text-amber-700">
                    (+{{ row.capitalized.toFixed(2) }})
                  </span>
                </td>
                <td class="py-2 text-right">{{ row.principal.toFixed(2) }}</td>
                <td class="py-2 text-right font-medium">{{ row.balanceAfter.toFixed(2) }}</td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="scheduleRows().length === 0" class="py-10 text-center text-sm text-slate-500">
            Nothing to show yet.
          </div>

          <div
            *ngIf="schedule.projection.length === 0 && schedule.projectionIsSimulation && projectionPayment > 0"
            class="mt-3 rounded-lg bg-rose-50 px-4 py-3 text-[11px] text-rose-800"
          >
            Paying {{ projectionPayment }} per period does not even cover the interest, so the balance would
            never go down.
          </div>
        </div>
      </div>
    </div>
  `,
})
export class LoansComponent implements OnInit {
  loans: LoanItem[] = [];
  occurrences: LoanPaymentOccurrence[] = [];
  accounts: AccountItem[] = [];
  categories: CategoryItem[] = [];
  isModalOpen = false;
  isSaving = false;
  isWorking = false;
  error = '';
  actionError = '';
  payment: { occurrence: LoanPaymentOccurrence; loan: LoanItem | null; amount: number } | null = null;
  schedule: LoanSchedule | null = null;
  scheduleLoanId = '';
  projectionPayment = 0;
  step = 1;
  readonly stepLabels = ['The debt', 'Schedule', 'Payment'];
  /** Global córdobas-per-dollar rate from Settings; one rate for everything. */
  fxRate = 36;
  editing: LoanItem | null = null;
  form: FormGroup;
  selectedMonth = new Date().toISOString().slice(0, 7);

  constructor(
    private readonly fb: FormBuilder,
    private readonly loansApi: LoansApiService,
    private readonly accountsApi: AccountsApiService,
    private readonly categoriesApi: CategoriesApiService,
    private readonly settingsApi: SettingsApiService,
    private readonly confirmDialog: ConfirmService,
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required]],
      kind: ['fixed_installment' as LoanKind, [Validators.required]],
      principal: [0, [Validators.required, Validators.min(0)]],
      installmentAmount: [0],
      interestRatePercent: [0],
      currency: ['USD', [Validators.required]],
      accountId: ['', [Validators.required]],
      categoryId: ['', [Validators.required]],
      scheduleType: ['monthly_days' as LoanScheduleType, [Validators.required]],
      daysOfMonth: ['15,30'],
      intervalDays: [7],
      startDate: [new Date().toISOString().slice(0, 10)],
      totalInstallments: [null],
      notes: [''],
      isActive: [true],
    });
  }

  ngOnInit() {
    this.loadReferences();
    this.loadLoans();
    this.loadMonth();
  }

  loadReferences() {
    this.accountsApi.list().subscribe({ next: (items) => (this.accounts = items) });
    this.categoriesApi.list({ type: 'expense' }).subscribe({ next: (items) => (this.categories = items) });
    this.settingsApi.list().subscribe({
      next: (items) => {
        const fx = items.find((item) => item.key === 'fxUsdToNio');
        const parsed = Number(fx?.value);
        if (Number.isFinite(parsed) && parsed > 0) {
          this.fxRate = parsed;
        }
      },
    });
  }

  loadLoans() {
    this.loansApi.list().subscribe({ next: (items) => (this.loans = items) });
  }

  loadMonth() {
    this.loansApi.occurrences(this.selectedMonth).subscribe({ next: (items) => (this.occurrences = items) });
  }

  openCreate() {
    this.editing = null;
    this.step = 1;
    this.error = '';
    this.form.reset({
      name: '',
      kind: 'fixed_installment',
      principal: 0,
      installmentAmount: 0,
      interestRatePercent: 0,
      currency: 'USD',
      accountId: '',
      categoryId: '',
      scheduleType: 'monthly_days',
      daysOfMonth: '15,30',
      intervalDays: 7,
      startDate: new Date().toISOString().slice(0, 10),
      totalInstallments: null,
      notes: '',
      isActive: true,
    });
    this.isModalOpen = true;
  }

  sourceActions(item: LoanItem): ActionMenuItem[] {
    return [
      { label: 'Payment history', action: () => this.openSchedule(item) },
      { label: 'Edit', action: () => this.openEdit(item) },
      { label: item.isActive ? 'Disable' : 'Enable', action: () => this.toggleActive(item) },
      { label: 'Delete', action: () => this.remove(item), danger: true },
    ];
  }

  occurrenceActions(item: LoanPaymentOccurrence): ActionMenuItem[] {
    const locked = item.status !== 'planned' || this.isWorking;
    return [
      { label: 'Confirm payment', action: () => this.confirm(item), disabled: locked },
      { label: 'Omit', action: () => this.omit(item), disabled: locked, danger: true },
    ];
  }

  toggleActive(item: LoanItem) {
    this.loansApi.update(item._id, { isActive: !item.isActive }).subscribe({
      next: () => this.loadLoans(),
    });
  }

  openEdit(item: LoanItem) {
    this.editing = item;
    this.step = 1;
    this.error = '';
    this.form.reset({
      name: item.name,
      kind: item.kind,
      principal: item.principal,
      installmentAmount: item.installmentAmount,
      interestRatePercent: item.interestRatePercent,
      currency: item.currency,
      accountId: this.resolveAccountId(item),
      categoryId: this.resolveCategoryId(item),
      scheduleType: item.scheduleType,
      daysOfMonth: (item.daysOfMonth || []).join(', '),
      intervalDays: item.intervalDays ?? 7,
      startDate: (item.startDate ?? new Date().toISOString()).slice(0, 10),
      totalInstallments: item.totalInstallments ?? null,
      notes: item.notes || '',
      isActive: item.isActive,
    });
    this.isModalOpen = true;
  }

  closeModal() {
    this.isModalOpen = false;
    this.error = '';
  }

  /** The account drives the currency: the API rejects any mismatch. */
  get selectedAccount(): AccountItem | undefined {
    return this.accounts.find((item) => item._id === this.form.value.accountId);
  }

  setCurrency(currency: 'USD' | 'NIO') {
    this.form.patchValue({ currency });
  }

  symbol(currency: 'USD' | 'NIO' | null | undefined): string {
    return currency === 'NIO' ? 'C$' : '$';
  }

  /** A córdoba debt paid from a dollar account, or the other way round. */
  get isCrossCurrency(): boolean {
    const account = this.selectedAccount;
    return Boolean(account && account.currency !== this.form.value.currency);
  }

  convert(amount: number, from: 'USD' | 'NIO', to: 'USD' | 'NIO'): number {
    if (from === to) return amount;
    return to === 'USD' ? amount / this.fxRate : amount * this.fxRate;
  }

  get conversionHint(): string {
    const account = this.selectedAccount;
    if (!account) return '';
    const debtCurrency = (this.form.value.currency || 'USD') as 'USD' | 'NIO';
    const due = Number(
      this.form.value.kind === 'interest_bearing'
        ? (Number(this.form.value.principal || 0) * Number(this.form.value.interestRatePercent || 0)) / 100
        : this.form.value.installmentAmount || 0,
    );
    const converted = this.convert(due, debtCurrency, account.currency);
    const base = `The debt is in ${debtCurrency} and ${account.name} is a ${account.currency} account, so each payment is converted at the global rate of ${this.fxRate} (Settings › fxUsdToNio).`;
    if (!due) return base;
    return `${base} A payment of ${this.symbol(debtCurrency)}${due.toFixed(2)} leaves the account as ${this.symbol(account.currency)}${converted.toFixed(2)}.`;
  }

  // ----- wizard -----
  get stepSubtitle(): string {
    if (this.step === 1) return 'What you owe and on what terms.';
    if (this.step === 2) return 'When the payments fall due.';
    return 'Which account pays it, and a last look.';
  }

  get cadenceSummary(): string {
    const value = this.form.value;
    if (value.scheduleType === 'interval_days') {
      const days = Number(value.intervalDays || 0);
      if (!days) return 'Set the interval to see the cadence.';
      const word = days === 7 ? 'weekly' : days === 14 ? 'fortnightly' : `every ${days} days`;
      return `A payment ${word}, roughly ${Math.round(365 / days)} a year.`;
    }
    const days = this.parseDays(String(value.daysOfMonth || ''));
    if (!days.length) return 'Set at least one day of the month.';
    return `A payment on day ${days.join(' and ')} of every month, ${days.length * 12} a year.`;
  }

  get reviewDebt(): string {
    const value = this.form.value;
    const currency = (value.currency || 'USD') as 'USD' | 'NIO';
    const principal = Number(value.principal || 0).toFixed(2);
    if (value.kind === 'interest_bearing') {
      return `${this.symbol(currency)}${principal} at ${value.interestRatePercent || 0}% per period on the balance`;
    }
    return `${this.symbol(currency)}${principal}, no interest`;
  }

  get reviewPayments(): string {
    const value = this.form.value;
    const currency = (value.currency || 'USD') as 'USD' | 'NIO';
    if (value.kind === 'interest_bearing') {
      const first = (Number(value.principal || 0) * Number(value.interestRatePercent || 0)) / 100;
      return `${this.symbol(currency)}${first.toFixed(2)} of interest in the first period, plus whatever you put toward capital`;
    }
    const amount = Number(value.installmentAmount || 0).toFixed(2);
    const count = value.totalInstallments ? ` × ${value.totalInstallments}` : '';
    return `${this.symbol(currency)}${amount}${count}, ${this.cadenceSummary.toLowerCase()}`;
  }

  get reviewAccount(): string {
    const account = this.selectedAccount;
    if (!account) return 'No account selected yet';
    if (!this.isCrossCurrency) return `${account.name} (${account.currency})`;
    const debtCurrency = (this.form.value.currency || 'USD') as 'USD' | 'NIO';
    const due = Number(
      this.form.value.kind === 'interest_bearing'
        ? (Number(this.form.value.principal || 0) * Number(this.form.value.interestRatePercent || 0)) / 100
        : this.form.value.installmentAmount || 0,
    );
    return `${account.name} (${account.currency}) — about ${this.symbol(account.currency)}${this.convert(due, debtCurrency, account.currency).toFixed(2)} per payment at ${this.fxRate}`;
  }

  canContinue(): boolean {
    const value = this.form.value;
    if (this.step === 1) {
      if (!String(value.name || '').trim()) return false;
      if (!Number(value.principal)) return false;
      if (value.kind === 'fixed_installment') return Number(value.installmentAmount) > 0;
      return Number(value.interestRatePercent) > 0;
    }
    if (this.step === 2) {
      if (value.scheduleType === 'interval_days') {
        return Number(value.intervalDays) > 0 && Boolean(value.startDate);
      }
      return this.parseDays(String(value.daysOfMonth || '')).length > 0;
    }
    return Boolean(value.accountId) && Boolean(value.categoryId);
  }

  next() {
    if (this.canContinue() && this.step < this.stepLabels.length) {
      this.step += 1;
      this.error = '';
    }
  }

  back() {
    if (this.step > 1) {
      this.step -= 1;
      this.error = '';
    }
  }

  /** Only lets you jump to a step you have already cleared. */
  goToStep(target: number) {
    if (target < this.step) {
      this.step = target;
      this.error = '';
    }
  }

  /** Surfaces what the API actually said instead of a generic message. */
  private apiError(err: unknown, fallback: string): string {
    const message = (err as { error?: { message?: string | string[] } })?.error?.message;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string' && message.trim()) return message;
    return fallback;
  }

  save() {
    if (this.form.invalid) {
      return;
    }

    this.isSaving = true;
    this.error = '';

    const value = this.form.value;
    const kind = (value.kind || 'fixed_installment') as LoanKind;
    const scheduleType = (value.scheduleType || 'monthly_days') as LoanScheduleType;

    const payload: LoanPayload = {
      name: String(value.name || ''),
      kind,
      principal: Number(value.principal || 0),
      currency: (value.currency || 'USD') as 'USD' | 'NIO',
      accountId: String(value.accountId || ''),
      categoryId: String(value.categoryId || ''),
      scheduleType,
      notes: String(value.notes || ''),
      isActive: Boolean(value.isActive),
    };

    if (scheduleType === 'monthly_days') {
      payload.daysOfMonth = this.parseDays(String(value.daysOfMonth || ''));
    } else {
      payload.intervalDays = Number(value.intervalDays || 0);
      payload.startDate = new Date(String(value.startDate)).toISOString();
    }

    if (kind === 'fixed_installment') {
      payload.installmentAmount = Number(value.installmentAmount || 0);
      if (value.totalInstallments) {
        payload.totalInstallments = Number(value.totalInstallments);
      }
    } else {
      payload.interestRatePercent = Number(value.interestRatePercent || 0);
    }

    const request = this.editing
      ? this.loansApi.update(this.editing._id, payload)
      : this.loansApi.create(payload);

    request.subscribe({
      next: () => {
        this.isSaving = false;
        this.isModalOpen = false;
        this.loadLoans();
        this.loadMonth();
      },
      error: (err) => {
        this.error = this.apiError(err, 'Unable to save loan');
        this.isSaving = false;
      },
    });
  }

  async remove(item: LoanItem) {
    const confirmed = await this.confirmDialog.open({
      title: 'Delete loan',
      message: `Delete "${item.name}"? Future planned payments will be removed. This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.loansApi.remove(item._id).subscribe({
      next: () => {
        this.loadLoans();
        this.loadMonth();
      },
    });
  }

  confirm(item: LoanPaymentOccurrence) {
    if (item.status !== 'planned') {
      return;
    }
    this.actionError = '';
    const loan = this.loans.find((candidate) => candidate._id === this.resolveLoanId(item)) ?? null;
    this.payment = { occurrence: item, loan, amount: item.amount };
  }

  /**
   * Mirrors the server: the interest for the period is covered first, what is
   * left cuts capital, and interest left unpaid is added to the balance.
   */
  paymentSplit() {
    const empty = { interest: 0, principal: 0, capitalized: 0, balanceAfter: 0 };
    if (!this.payment) {
      return empty;
    }
    const paid = Number(this.payment.amount || 0);
    const loan = this.payment.loan;

    if (!loan || loan.kind !== 'interest_bearing') {
      const balance = loan?.currentBalance ?? 0;
      const principal = Math.min(paid, balance);
      return { interest: 0, principal, capitalized: 0, balanceAfter: balance - principal };
    }

    const balance = loan.currentBalance;
    const interestDue = loan.nextInterestDue;

    if (paid >= interestDue) {
      const principal = Math.min(paid - interestDue, balance);
      return { interest: interestDue, principal, capitalized: 0, balanceAfter: balance - principal };
    }

    const capitalized = interestDue - paid;
    return { interest: paid, principal: 0, capitalized, balanceAfter: balance + capitalized };
  }

  /** What the account is actually debited, once converted. */
  accountChargeForPayment(): number {
    if (!this.payment?.loan) return Number(this.payment?.amount || 0);
    const loan = this.payment.loan;
    const amount = Number(this.payment.amount || 0);
    if (!loan.crossCurrency) return amount;
    return loan.accountCurrency === 'USD' ? amount / loan.exchangeRate : amount * loan.exchangeRate;
  }

  submitPayment() {
    if (!this.payment) {
      return;
    }
    this.isWorking = true;
    this.actionError = '';
    this.loansApi
      .confirmOccurrence(this.payment.occurrence._id, { paidAmount: Number(this.payment.amount) })
      .subscribe({
        next: () => {
          this.isWorking = false;
          this.payment = null;
          this.loadLoans();
          this.loadMonth();
        },
        error: (err) => {
          this.actionError = this.apiError(err, 'Unable to record this payment');
          this.isWorking = false;
        },
      });
  }

  openSchedule(item: LoanItem) {
    this.scheduleLoanId = item._id;
    this.projectionPayment =
      item.kind === 'interest_bearing' ? Math.round(item.nextInterestDue * 1.25) : item.installmentAmount;
    this.reloadSchedule();
  }

  reloadSchedule() {
    if (!this.scheduleLoanId) {
      return;
    }
    this.loansApi.schedule(this.scheduleLoanId, this.projectionPayment || undefined).subscribe({
      next: (data) => (this.schedule = data),
      error: (err) => {
        this.actionError = this.apiError(err, 'Unable to load the schedule');
        this.schedule = null;
      },
    });
  }

  scheduleRows(): LoanScheduleRow[] {
    if (!this.schedule) {
      return [];
    }
    return [...this.schedule.history, ...this.schedule.projection];
  }

  omit(item: LoanPaymentOccurrence) {
    if (item.status !== 'planned') {
      return;
    }
    this.isWorking = true;
    this.loansApi.omitOccurrence(item._id).subscribe({
      next: () => {
        this.isWorking = false;
        this.actionError = '';
        this.loadMonth();
      },
      error: (err) => {
        this.actionError = this.apiError(err, 'Unable to omit this payment');
        this.isWorking = false;
      },
    });
  }

  reactivate(item: LoanPaymentOccurrence) {
    if (item.status !== 'omitted') {
      return;
    }
    this.isWorking = true;
    this.loansApi.reactivateOccurrence(item._id).subscribe({
      next: () => {
        this.isWorking = false;
        this.actionError = '';
        this.loadMonth();
      },
      error: (err) => {
        this.actionError = this.apiError(err, 'Unable to reactivate this payment');
        this.isWorking = false;
      },
    });
  }

  setKind(kind: LoanKind) {
    this.form.patchValue({ kind });
  }

  setScheduleType(scheduleType: LoanScheduleType) {
    this.form.patchValue({ scheduleType });
  }

  setDays(days: string) {
    this.form.patchValue({ daysOfMonth: days });
  }

  setInterval(days: number) {
    this.form.patchValue({ intervalDays: days });
  }

  /** Live example of what the rate means on the principal entered. */
  get interestPreview(): string {
    const principal = Number(this.form.value.principal || 0);
    const rate = Number(this.form.value.interestRatePercent || 0);
    if (!principal || !rate) {
      return 'Enter the principal and the rate to see what each period costs.';
    }
    const interest = (principal * rate) / 100;
    return `At ${rate}% on ${principal.toFixed(2)}, the first period charges ${interest.toFixed(2)} in interest. Anything you pay above that reduces the capital.`;
  }

  periodWord(item: LoanItem): string {
    if (item.scheduleType === 'interval_days') {
      if (item.intervalDays === 7) return 'weekly';
      if (item.intervalDays === 14) return 'fortnightly';
      if (item.intervalDays === 30) return 'monthly';
      return `every ${item.intervalDays}d`;
    }
    return 'monthly';
  }

  scheduleLabel(item: LoanItem): string {
    if (item.scheduleType === 'interval_days') {
      return `every ${item.intervalDays} day${item.intervalDays === 1 ? '' : 's'}`;
    }
    const days = item.daysOfMonth || [];
    return `day${days.length === 1 ? '' : 's'} ${days.join(', ')}`;
  }

  statusClass(item: LoanItem): string {
    if (item.status === 'settled') return 'bg-emerald-100 text-emerald-800';
    return item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500';
  }

  resolveLoanId(item: LoanPaymentOccurrence): string {
    const loan = item.loanId as { _id: string } | string;
    return typeof loan === 'string' ? loan : loan?._id || '';
  }

  parseDays(raw: string) {
    return raw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => !Number.isNaN(value) && value > 0 && value <= 31);
  }

  resolveAccountId(item: LoanItem) {
    return typeof item.accountId === 'string' ? item.accountId : item.accountId?._id || '';
  }

  resolveCategoryId(item: LoanItem) {
    return typeof item.categoryId === 'string' ? item.categoryId : item.categoryId?._id || '';
  }

  resolveAccountName(item: LoanItem | LoanPaymentOccurrence) {
    const account = item.accountId as { _id: string; name: string } | string;
    return typeof account === 'string' ? account : account?.name || '';
  }

  resolveLoanName(item: LoanPaymentOccurrence) {
    const loan = item.loanId as { _id: string; name: string } | string;
    return typeof loan === 'string' ? loan : loan?.name || '';
  }

  formatDate(value?: string) {
    if (!value) {
      return '-';
    }
    return new Date(value).toLocaleDateString();
  }

  formatMoney(amount: number, currency: 'USD' | 'NIO') {
    return `${currency} ${amount.toFixed(2)}`;
  }

  // ----- helpers for revamped UI -----
  monthLabel(): string {
    const [yearStr, monthStr] = this.selectedMonth.split('-');
    const year = Number(yearStr);
    const monthIndex = Number(monthStr) - 1;
    if (Number.isNaN(year) || Number.isNaN(monthIndex)) return this.selectedMonth;
    return new Date(year, monthIndex, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }

  confirmationProgress() {
    const total = this.occurrences.length;
    const confirmed = this.occurrences.filter((o) => o.status === 'confirmed').length;
    const percent = total === 0 ? 0 : Math.round((confirmed / total) * 100);
    return { confirmed, total, percent };
  }

  daysOverdue(date?: string): number {
    if (!date) return 0;
    const d = new Date(date).getTime();
    if (Number.isNaN(d)) return 0;
    return Math.max(0, Math.floor((Date.now() - d) / (24 * 60 * 60 * 1000)));
  }

  overdueCount(): number {
    const now = Date.now();
    return this.occurrences.filter(
      (o) => o.status === 'planned' && new Date(o.date).getTime() < now,
    ).length;
  }

  activeLoanCount(): number {
    return this.loans.filter((l) => l.isActive).length;
  }

  totalByCurrency(currency: 'USD' | 'NIO', mode: 'planned' | 'confirmed'): number {
    return this.occurrences
      .filter((o) => o.currency === currency)
      .filter((o) => (mode === 'confirmed' ? o.status === 'confirmed' : o.status !== 'omitted'))
      .reduce((sum, o) => sum + (o.amount ?? 0), 0);
  }

  totalOutstanding(currency: 'USD' | 'NIO'): number {
    return this.loans
      .filter((l) => l.status === 'active' && l.currency === currency)
      .reduce((sum, l) => sum + (l.currentBalance || 0), 0);
  }

  totalPrincipal(currency: 'USD' | 'NIO'): number {
    return this.loans
      .filter((l) => l.isActive && l.currency === currency)
      .reduce((sum, l) => sum + (l.principal ?? 0), 0);
  }

  grouped() {
    const now = Date.now();
    const week = now + 7 * 24 * 60 * 60 * 1000;
    const groups = {
      overdue: [] as LoanPaymentOccurrence[],
      thisWeek: [] as LoanPaymentOccurrence[],
      later: [] as LoanPaymentOccurrence[],
      confirmed: [] as LoanPaymentOccurrence[],
      omitted: [] as LoanPaymentOccurrence[],
    };
    for (const o of this.occurrences) {
      const t = new Date(o.date).getTime();
      if (o.status === 'confirmed') groups.confirmed.push(o);
      else if (o.status === 'omitted') groups.omitted.push(o);
      else if (Number.isNaN(t)) groups.later.push(o);
      else if (t < now) groups.overdue.push(o);
      else if (t <= week) groups.thisWeek.push(o);
      else groups.later.push(o);
    }
    const byDate = (a: LoanPaymentOccurrence, b: LoanPaymentOccurrence) =>
      a.date.localeCompare(b.date);
    groups.overdue.sort(byDate);
    groups.thisWeek.sort(byDate);
    groups.later.sort(byDate);
    groups.confirmed.sort(byDate);
    groups.omitted.sort(byDate);
    return groups;
  }

  formatShortDate(date?: string) {
    if (!date) return '—';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
