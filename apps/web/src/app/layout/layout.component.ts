import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationsApiService } from '../core/services/notifications-api.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../shared/icon/icon.component';

type NavItem = { label: string; path: string; icon: string };
type NavGroup = { key: string; label: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'sales',
    label: 'Sales',
    items: [
      { label: 'Clients', path: '/clients', icon: 'clients' },
      { label: 'Services', path: '/services', icon: 'services' },
      { label: 'Estimates', path: '/estimates', icon: 'estimates' },
      { label: 'Contracts', path: '/contracts', icon: 'contracts' },
      { label: 'Projects', path: '/projects', icon: 'projects' },
      { label: 'Payments', path: '/payments', icon: 'payments' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    items: [
      { label: 'Accounts', path: '/accounts', icon: 'accounts' },
      { label: 'Categories', path: '/categories', icon: 'categories' },
      { label: 'Transactions', path: '/transactions', icon: 'transactions' },
      { label: 'Budgets', path: '/budgets', icon: 'budgets' },
      { label: 'Summary', path: '/finance', icon: 'finance' },
      { label: 'Net worth', path: '/net-worth', icon: 'net-worth' },
      { label: 'Planned income', path: '/planned-income', icon: 'planned-income' },
      { label: 'Recurring expenses', path: '/recurring-expenses', icon: 'recurring-expenses' },
      { label: 'Loans', path: '/loans', icon: 'loans' },
      { label: 'Subscriptions', path: '/subscriptions', icon: 'subscriptions' },
    ],
  },
  {
    key: 'insights',
    label: 'Insights',
    items: [
      { label: 'Reports', path: '/reports', icon: 'reports' },
      { label: 'Site monitor', path: '/site-monitor', icon: 'site-monitor' },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    items: [
      { label: 'Users', path: '/users', icon: 'users' },
      { label: 'Notification center', path: '/notification-center', icon: 'notification-center' },
      { label: 'Reconcile', path: '/reconcile', icon: 'reconcile' },
      { label: 'Import', path: '/imports', icon: 'imports' },
      { label: 'Settings', path: '/settings', icon: 'settings' },
    ],
  },
];

const NAV_STATE_KEY = 'aurum_nav_groups_collapsed';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmDialogComponent, IconComponent],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <div class="flex min-h-screen">
        <div
          *ngIf="isMobileNavOpen"
          class="fixed inset-0 z-40 bg-slate-900/60 lg:hidden"
          (click)="closeMobileNav()"
        ></div>
        <aside
          class="fixed inset-y-0 left-0 z-50 w-64 -translate-x-full bg-slate-900 px-4 py-6 text-white transition-transform lg:static lg:min-h-screen lg:translate-x-0"
          [class.translate-x-0]="isMobileNavOpen"
        >
          <div class="text-2xl font-semibold tracking-tight">AurumLedger</div>
          <div class="mt-6 text-xs uppercase tracking-[0.2em] text-slate-400">
            MEAN Consultors
          </div>

          <nav class="mt-6 space-y-1 text-sm">
            <!-- Standalone top links -->
            <a
              routerLink="/dashboard"
              routerLinkActive="bg-slate-800 text-white"
              class="flex items-center gap-3 rounded px-3 py-2 text-slate-200 transition hover:bg-slate-800/60"
            >
              <app-icon name="dashboard" [size]="16" class="shrink-0 text-slate-400" />
              <span>Dashboard</span>
            </a>
            <a
              routerLink="/notifications"
              routerLinkActive="bg-slate-800 text-white"
              class="flex items-center justify-between gap-3 rounded px-3 py-2 text-slate-200 transition hover:bg-slate-800/60"
            >
              <span class="flex items-center gap-3">
                <app-icon name="alerts" [size]="16" class="shrink-0 text-slate-400" />
                <span>Alerts</span>
              </span>
              <span
                *ngIf="alertCount > 0"
                class="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300"
              >{{ alertCount }}</span>
            </a>

            <!-- Grouped sections -->
            <div *ngFor="let group of navGroups" class="pt-3">
              <button
                type="button"
                (click)="toggleGroup(group.key)"
                class="flex w-full items-center justify-between rounded px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-white"
              >
                <span>{{ group.label }}</span>
                <svg
                  class="h-3 w-3 transition-transform"
                  [class.rotate-90]="isGroupOpen(group.key)"
                  viewBox="0 0 12 12"
                  fill="none"
                >
                  <path d="M4 2l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <div *ngIf="isGroupOpen(group.key)" class="mt-1 space-y-1">
                <a
                  *ngFor="let item of group.items"
                  [routerLink]="item.path"
                  routerLinkActive="bg-slate-800 text-white"
                  class="flex items-center gap-3 rounded px-3 py-2 text-slate-200 transition hover:bg-slate-800/60"
                >
                  <app-icon [name]="item.icon" [size]="16" class="shrink-0 text-slate-400" />
                  <span>{{ item.label }}</span>
                </a>
              </div>
            </div>
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

  navGroups = NAV_GROUPS;
  private collapsed = new Set<string>();

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly notificationsApi: NotificationsApiService,
  ) {
    // Restore collapse state from localStorage (default: all open).
    try {
      const raw = localStorage.getItem(NAV_STATE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as string[];
        if (Array.isArray(arr)) {
          this.collapsed = new Set(arr);
        }
      }
    } catch {
      // ignore — fallback to all open
    }
    // Auto-expand whichever group contains the current route.
    const currentPath = this.router.url;
    for (const group of NAV_GROUPS) {
      if (group.items.some((i) => currentPath.startsWith(i.path))) {
        this.collapsed.delete(group.key);
      }
    }
  }

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

  isGroupOpen(key: string) {
    return !this.collapsed.has(key);
  }

  toggleGroup(key: string) {
    if (this.collapsed.has(key)) {
      this.collapsed.delete(key);
    } else {
      this.collapsed.add(key);
    }
    this.persistState();
  }

  private persistState() {
    try {
      localStorage.setItem(NAV_STATE_KEY, JSON.stringify(Array.from(this.collapsed)));
    } catch {
      // ignore
    }
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
