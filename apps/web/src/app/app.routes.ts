import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { LayoutComponent } from './layout/layout.component';
import { LoginComponent } from './features/auth/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ClientsComponent } from './features/clients/clients.component';
import { ServicesComponent } from './features/services/services.component';
import { EstimatesComponent } from './features/estimates/estimates.component';
import { ContractsComponent } from './features/contracts/contracts.component';
import { PaymentsComponent } from './features/payments/payments.component';
import { ReportsComponent } from './features/reports/reports.component';
import { ImportsComponent } from './features/imports/imports.component';
import { UsersComponent } from './features/users/users.component';
import { AccountsComponent } from './features/accounts/accounts.component';
import { CategoriesComponent } from './features/categories/categories.component';
import { TransactionsComponent } from './features/transactions/transactions.component';
import { BudgetsComponent } from './features/budgets/budgets.component';
import { FinanceComponent } from './features/finance/finance.component';
import { SettingsComponent } from './features/settings/settings.component';
import { PlannedIncomesComponent } from './features/planned-incomes/planned-incomes.component';
import { NotificationsComponent } from './features/notifications/notifications.component';
import { RecurringExpensesComponent } from './features/recurring-expenses/recurring-expenses.component';
import { LoansComponent } from './features/loans/loans.component';
import { SubscriptionsComponent } from './features/subscriptions/subscriptions.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'clients', component: ClientsComponent },
      { path: 'services', component: ServicesComponent },
      { path: 'estimates', component: EstimatesComponent },
      { path: 'contracts', component: ContractsComponent },
      { path: 'payments', component: PaymentsComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'imports', component: ImportsComponent },
      { path: 'users', component: UsersComponent, canActivate: [adminGuard] },
      { path: 'accounts', component: AccountsComponent },
      { path: 'categories', component: CategoriesComponent },
      { path: 'transactions', component: TransactionsComponent },
      { path: 'budgets', component: BudgetsComponent },
      { path: 'finance', component: FinanceComponent },
      { path: 'planned-income', component: PlannedIncomesComponent },
      { path: 'recurring-expenses', component: RecurringExpensesComponent },
      { path: 'loans', component: LoansComponent },
      { path: 'subscriptions', component: SubscriptionsComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: 'settings', component: SettingsComponent },
    ],
  },
];
