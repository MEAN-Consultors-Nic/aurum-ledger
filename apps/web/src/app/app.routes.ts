import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/admin.guard';
import { LayoutComponent } from './layout/layout.component';
import { LoginComponent } from './features/auth/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { ClientsComponent } from './features/clients/clients.component';
import { ClientDetailComponent } from './features/clients/client-detail.component';
import { ServicesComponent } from './features/services/services.component';
import { EstimatesComponent } from './features/estimates/estimates.component';
import { EstimateEditorComponent } from './features/estimates/estimate-editor.component';
import { ContractsComponent } from './features/contracts/contracts.component';
import { ProjectsComponent } from './features/projects/projects.component';
import { ProjectDetailComponent } from './features/projects/project-detail.component';
import { PaymentsComponent } from './features/payments/payments.component';
import { ReportsComponent } from './features/reports/reports.component';
import { ImportsComponent } from './features/imports/imports.component';
import { UsersComponent } from './features/users/users.component';
import { AccountsComponent } from './features/accounts/accounts.component';
import { CategoriesComponent } from './features/categories/categories.component';
import { TransactionsComponent } from './features/transactions/transactions.component';
import { BudgetsComponent } from './features/budgets/budgets.component';
import { FinanceComponent } from './features/finance/finance.component';
import { NetWorthComponent } from './features/net-worth/net-worth.component';
import { SiteMonitorComponent } from './features/site-monitor/site-monitor.component';
import { CustomFieldsAdminComponent } from './features/custom-fields/custom-fields-admin.component';
import { VaultComponent } from './features/vault/vault.component';
import { ReconcileComponent } from './features/reconcile/reconcile.component';
import { SettingsComponent } from './features/settings/settings.component';
import { PlannedIncomesComponent } from './features/planned-incomes/planned-incomes.component';
import { NotificationsComponent } from './features/notifications/notifications.component';
import { NotificationCenterComponent } from './features/notification-center/notification-center.component';
import { TemplateEditorComponent } from './features/notification-center/template-editor.component';
import { RecurringExpensesComponent } from './features/recurring-expenses/recurring-expenses.component';
import { LoansComponent } from './features/loans/loans.component';
import { SubscriptionsComponent } from './features/subscriptions/subscriptions.component';
import { PortalEstimateComponent } from './features/portal/portal-estimate.component';
import { PortalProjectComponent } from './features/portal/portal-project.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  // Public, unauthenticated client portal — sits outside LayoutComponent
  // and the auth guard so external clients can open the share links.
  { path: 'portal/estimates/:token', component: PortalEstimateComponent },
  { path: 'portal/projects/:token', component: PortalProjectComponent },
  {
    path: '',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', component: DashboardComponent },
      { path: 'clients', component: ClientsComponent },
      { path: 'clients/:id', component: ClientDetailComponent },
      { path: 'services', component: ServicesComponent },
      { path: 'estimates', component: EstimatesComponent },
      { path: 'estimates/new', component: EstimateEditorComponent },
      { path: 'estimates/:id', component: EstimateEditorComponent },
      { path: 'contracts', component: ContractsComponent },
      { path: 'projects', component: ProjectsComponent },
      { path: 'projects/:id', component: ProjectDetailComponent },
      { path: 'payments', component: PaymentsComponent },
      { path: 'reports', component: ReportsComponent },
      { path: 'imports', component: ImportsComponent },
      { path: 'users', component: UsersComponent, canActivate: [adminGuard] },
      { path: 'accounts', component: AccountsComponent },
      { path: 'categories', component: CategoriesComponent },
      { path: 'transactions', component: TransactionsComponent },
      { path: 'budgets', component: BudgetsComponent },
      { path: 'finance', component: FinanceComponent },
      { path: 'net-worth', component: NetWorthComponent },
      { path: 'site-monitor', component: SiteMonitorComponent },
      { path: 'planned-income', component: PlannedIncomesComponent },
      { path: 'recurring-expenses', component: RecurringExpensesComponent },
      { path: 'loans', component: LoansComponent },
      { path: 'subscriptions', component: SubscriptionsComponent },
      { path: 'notifications', component: NotificationsComponent },
      { path: 'notification-center', component: NotificationCenterComponent },
      { path: 'notification-center/templates/new', component: TemplateEditorComponent },
      { path: 'notification-center/templates/:id', component: TemplateEditorComponent },
      { path: 'reconcile', component: ReconcileComponent, canActivate: [adminGuard] },
      { path: 'settings', component: SettingsComponent },
      { path: 'custom-fields', component: CustomFieldsAdminComponent, canActivate: [adminGuard] },
      { path: 'vault', component: VaultComponent },
    ],
  },
];
