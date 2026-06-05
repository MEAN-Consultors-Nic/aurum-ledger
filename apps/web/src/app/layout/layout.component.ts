import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { NotificationsApiService } from '../core/services/notifications-api.service';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog.component';
import { IconComponent } from '../shared/icon/icon.component';
import { CommandPaletteComponent } from '../shared/command-palette/command-palette.component';

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
      { label: 'Custom fields', path: '/custom-fields', icon: 'custom-fields' },
      { label: 'Import', path: '/imports', icon: 'imports' },
      { label: 'Settings', path: '/settings', icon: 'settings' },
    ],
  },
];

const NAV_STATE_KEY = 'aurum_nav_groups_collapsed';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    ConfirmDialogComponent,
    IconComponent,
    CommandPaletteComponent,
  ],
  template: `
    <div class="min-h-screen bg-[#F7F9FC] text-slate-900">
      <div class="flex min-h-screen">
        <div
          *ngIf="isMobileNavOpen"
          class="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          (click)="closeMobileNav()"
        ></div>
        <aside
          class="fixed inset-y-0 left-0 z-50 w-64 -translate-x-full border-r border-slate-200 bg-white px-3 py-6 text-slate-700 transition-transform lg:static lg:min-h-screen lg:translate-x-0"
          [class.translate-x-0]="isMobileNavOpen"
        >
          <a routerLink="/dashboard" class="flex items-center gap-2 px-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-md bg-navy-700 text-white">
              <!-- Helm wheel mark -->
              <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1"/>
              </svg>
            </span>
            <span class="text-lg font-semibold tracking-tight text-slate-900">Helm</span>
          </a>
          <div class="mt-1 px-2 text-[10px] uppercase tracking-[0.2em] text-slate-400">
            MEAN Consultors
          </div>

          <nav class="mt-6 space-y-0.5 text-sm">
            <!-- Standalone top links -->
            <a
              routerLink="/dashboard"
              routerLinkActive="bg-navy-50 !text-navy-700 !border-navy-600 font-medium"
              class="flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <app-icon name="dashboard" [size]="16" class="shrink-0" />
              <span>Dashboard</span>
            </a>
            <a
              routerLink="/notifications"
              routerLinkActive="bg-navy-50 !text-navy-700 !border-navy-600 font-medium"
              class="flex items-center justify-between gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <span class="flex items-center gap-3">
                <app-icon name="alerts" [size]="16" class="shrink-0" />
                <span>Alerts</span>
              </span>
              <span
                *ngIf="alertCount > 0"
                class="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700"
              >{{ alertCount }}</span>
            </a>
            <a
              routerLink="/vault"
              routerLinkActive="bg-navy-50 !text-navy-700 !border-navy-600 font-medium"
              class="flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <app-icon name="vault" [size]="16" class="shrink-0" />
              <span>Vault</span>
            </a>

            <!-- Grouped sections -->
            <div *ngFor="let group of navGroups" class="pt-4">
              <button
                type="button"
                (click)="toggleGroup(group.key)"
                class="flex w-full items-center justify-between rounded px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-slate-600"
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
              <div *ngIf="isGroupOpen(group.key)" class="mt-1 space-y-0.5">
                <a
                  *ngFor="let item of group.items"
                  [routerLink]="item.path"
                  routerLinkActive="bg-navy-50 !text-navy-700 !border-navy-600 font-medium"
                  class="flex items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                >
                  <app-icon [name]="item.icon" [size]="16" class="shrink-0" />
                  <span>{{ item.label }}</span>
                </a>
              </div>
            </div>
          </nav>
        </aside>
        <main class="flex-1">
          <header class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="rounded-md border border-slate-200 px-3 py-1.5 text-xs uppercase tracking-wide text-slate-700 lg:hidden"
                (click)="toggleMobileNav()"
              >
                Menu
              </button>
              <div class="text-base font-semibold text-slate-900">Dashboard</div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="openSearch()"
                title="Search (⌘K)"
                class="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                Search
                <kbd class="ml-1 hidden rounded border border-slate-200 bg-slate-50 px-1 font-mono text-[10px] tracking-wider text-slate-500 lg:inline">
                  ⌘K
                </kbd>
              </button>
              <a
                routerLink="/notifications"
                class="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs uppercase tracking-wide text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              >
                Alerts
                <span
                  *ngIf="alertCount > 0"
                  class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700"
                >
                  {{ alertCount }}
                </span>
              </a>
              <div class="hidden text-sm text-slate-600 sm:block">{{ userName }}</div>
              <button
                type="button"
                (click)="logout()"
                class="rounded-md bg-navy-700 px-3 py-1.5 text-xs uppercase tracking-wide text-white transition hover:bg-navy-800"
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
      <app-command-palette #palette />
    </div>
  `,
})
export class LayoutComponent implements OnInit {
  @ViewChild('palette') palette?: CommandPaletteComponent;

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

  openSearch() {
    this.palette?.open();
  }

  toggleMobileNav() {
    this.isMobileNavOpen = !this.isMobileNavOpen;
  }

  closeMobileNav() {
    this.isMobileNavOpen = false;
  }
}
