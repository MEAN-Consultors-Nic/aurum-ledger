import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { AssetsModule } from './assets/assets.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { ClientsModule } from './clients/clients.module';
import { ContractsModule } from './contracts/contracts.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { EstimatesModule } from './estimates/estimates.module';
import { FinanceModule } from './finance/finance.module';
import { ImportsModule } from './imports/imports.module';
import { NetWorthModule } from './net-worth/net-worth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { MailerModule } from './mailer/mailer.module';
import { NotificationsEngineModule } from './notifications-engine/notifications-engine.module';
import { ReconcileModule } from './reconcile/reconcile.module';
import { PlannedIncomesModule } from './planned-incomes/planned-incomes.module';
import { ProjectsModule } from './projects/projects.module';
import { PublicModule } from './public/public.module';
import { RecurringExpensesModule } from './recurring-expenses/recurring-expenses.module';
import { ReportsModule } from './reports/reports.module';
import { LoansModule } from './loans/loans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { SearchModule } from './search/search.module';
import { SettingsModule } from './settings/settings.module';
import { ServicesModule } from './services/services.module';
import { SiteAuditModule } from './site-audit/site-audit.module';
import { SiteMonitorModule } from './site-monitor/site-monitor.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';
import { VaultModule } from './vault/vault.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        // CRITICAL: Disable strictPopulate globally for all schemas
        // This prevents StrictPopulateError when creating documents with refs
        mongoose.set('strictPopulate', false);

        const uri = config.get<string>('MONGO_URI') || '';
        const dbName = config.get<string>('DATA_BASE_NAME');

        return {
          uri,
          dbName,
          minPoolSize: 10,
          maxPoolSize: 100,
          socketTimeoutMS: 30000,
          connectTimeoutMS: 10000,
          retryWrites: true,
          w: 'majority',
        };
      },
    }),
    AuthModule,
    UsersModule,
    CustomFieldsModule,
    AccountsModule,
    AssetsModule,
    AttachmentsModule,
    NetWorthModule,
    CategoriesModule,
    BudgetsModule,
    TransactionsModule,
    FinanceModule,
    SettingsModule,
    ClientsModule,
    ServicesModule,
    ContractsModule,
    EstimatesModule,
    PaymentsModule,
    PlannedIncomesModule,
    RecurringExpensesModule,
    ReportsModule,
    LoansModule,
    SubscriptionsModule,
    SiteMonitorModule,
    SiteAuditModule,
    SearchModule,
    ImportsModule,
    NotificationsModule,
    ProjectsModule,
    PublicModule,
    VaultModule,
    MailerModule,
    NotificationsEngineModule,
    ReconcileModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
