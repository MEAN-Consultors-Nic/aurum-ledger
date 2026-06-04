import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationsApiService } from '../core/services/notifications-api.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmDialogComponent],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <div class="flex">
        <div
          *ngIf="isMobileNavOpen"
          class="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
          (click)="closeMobileNav()"
        ></div>
        <aside
          class="fixed inset-y-0 left-0 z-50 w-64 -translate-x-full bg-slate-900 px-4 py-6 text-white transition-transform lg:static lg:translate-x-0"
          [class.translate-x-0]="isMobileNavOpen"
        >
          <div class="text-2xl font-semibold tracking-tight">AurumLedger</div>
          <div class="mt-6 text-xs uppercase tracking-[0.2em] text-slate-400">
            MEAN Consultors
          </div>
          <nav class="mt-8 space-y-2 text-sm">
            <a routerLink="/dashboard" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Dashboard</a>
            <a routerLink="/notifications" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Notifications</a>
            <a routerLink="/clients" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Clients</a>
            <a routerLink="/services" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Services</a>
            <a routerLink="/estimates" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Estimates</a>
            <a routerLink="/contracts" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Contracts</a>
            <a routerLink="/payments" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Payments</a>
            <a routerLink="/reports" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Reports</a>
            <a routerLink="/imports" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Import</a>
            <a routerLink="/users" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Users</a>
            <div class="pt-4 text-xs uppercase tracking-[0.2em] text-slate-500">Finance</div>
            <a routerLink="/accounts" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Accounts</a>
            <a routerLink="/categories" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Categories</a>
            <a routerLink="/transactions" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Transactions</a>
            <a routerLink="/budgets" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Budgets</a>
            <a routerLink="/finance" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Summary</a>
            <a routerLink="/planned-income" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Planned income</a>
            <a routerLink="/recurring-expenses" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Recurring expenses</a>
            <a routerLink="/loans" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Loans</a>
            <a routerLink="/subscriptions" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Subscriptions</a>
            <a routerLink="/settings" routerLinkActive="bg-slate-800" class="block rounded px-3 py-2">Settings</a>
          </nav>
        </aside>
        <main class="flex-1">
          <header class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="rounded border border-slate-200 px-3 py-2 text-xs uppercase tracking-wide text-slate-700 lg:hidden"
                (click)="toggleMobileNav()"
              >
                Menu
              </button>
              <div class="text-lg font-semibold">Dashboard</div>
            </div>
            <div class="flex items-center gap-3">
              <a
                routerLink="/notifications"
                class="flex items-center gap-2 rounded border border-slate-200 px-3 py-1.5 text-xs uppercase tracking-wide text-slate-700"
              >
                Alerts
                <span
                  class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                >
                  {{ alertCount }}
                </span>
              </a>
              <div class="text-sm text-slate-600">{{ userName }}</div>
              <button
                type="button"
                (click)="logout()"
                class="rounded bg-slate-900 px-3 py-1.5 text-xs uppercase tracking-wide text-white"
              >
                Logout
              </button>
            </div>
          </header>
          <section class="p-4 sm:p-6">
            <router-outlet />
          </section>
        </main>
      </div>
      <app-confirm-dialog />
    </div>
  `,
})
export class LayoutComponent implements OnInit {
  isMobileNavOpen = false;
  alertCount = 0;

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly notificationsApi: NotificationsApiService,
  ) {}

  ngOnInit() {
    this.notificationsApi.getNotifications().subscribe({
      next: (data) => {
        const plannedIncome = data.plannedIncome?.count ?? 0;
        const recurringExpense = data.recurringExpense?.count ?? 0;
        const budget = data.budget?.count ?? 0;
        const loans = data.loans?.count ?? 0;
        const subscriptions = data.subscriptions?.count ?? 0;
        this.alertCount = plannedIncome + recurringExpense + budget + loans + subscriptions;
      },
      error: () => {
        this.alertCount = 0;
      },
    });
  }

  get userName() {
    return this.authService.user()?.name ?? 'User';
  }

  logout() {
    this.authService.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }

  toggleMobileNav() {
    this.isMobileNavOpen = !this.isMobileNavOpen;
  }

  closeMobileNav() {
    this.isMobileNavOpen = false;
  }
}
