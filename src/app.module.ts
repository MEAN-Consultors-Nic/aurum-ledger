import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import mongoose from 'mongoose';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { BudgetsModule } from './budgets/budgets.module';
import { CategoriesModule } from './categories/categories.module';
import { ClientsModule } from './clients/clients.module';
import { ContractsModule } from './contracts/contracts.module';
import { EstimatesModule } from './estimates/estimates.module';
import { FinanceModule } from './finance/finance.module';
import { ImportsModule } from './imports/imports.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PlannedIncomesModule } from './planned-incomes/planned-incomes.module';
import { ReportsModule } from './reports/reports.module';
import { SettingsModule } from './settings/settings.module';
import { ServicesModule } from './services/services.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UsersModule } from './users/users.module';

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
    AccountsModule,
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
    ReportsModule,
    ImportsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
