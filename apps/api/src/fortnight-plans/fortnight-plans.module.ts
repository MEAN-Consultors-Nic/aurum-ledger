import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsModule } from '../accounts/accounts.module';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import { LoansModule } from '../loans/loans.module';
import {
  LoanPaymentOccurrence,
  LoanPaymentOccurrenceSchema,
} from '../loans/schemas/loan-payment-occurrence.schema';
import { PlannedIncomesModule } from '../planned-incomes/planned-incomes.module';
import {
  PlannedIncomeOccurrence,
  PlannedIncomeOccurrenceSchema,
} from '../planned-incomes/schemas/planned-income-occurrence.schema';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import {
  RecurringExpenseOccurrence,
  RecurringExpenseOccurrenceSchema,
} from '../recurring-expenses/schemas/recurring-expense-occurrence.schema';
import { SettingsModule } from '../settings/settings.module';
import {
  SubscriptionOccurrence,
  SubscriptionOccurrenceSchema,
} from '../subscriptions/schemas/subscription-occurrence.schema';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/schemas/transaction.schema';
import { TransactionsModule } from '../transactions/transactions.module';
import { FortnightPlansController } from './fortnight-plans.controller';
import { FortnightPlansService } from './fortnight-plans.service';
import { FortnightSourcesService } from './fortnight-sources.service';
import {
  FortnightPlan,
  FortnightPlanSchema,
} from './schemas/fortnight-plan.schema';

@Module({
  imports: [
    AccountsModule,
    LoansModule,
    PlannedIncomesModule,
    RecurringExpensesModule,
    SettingsModule,
    SubscriptionsModule,
    TransactionsModule,
    MongooseModule.forFeature([
      { name: FortnightPlan.name, schema: FortnightPlanSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Category.name, schema: CategorySchema },
      // Read-only views of the schedules the planner mirrors.
      { name: LoanPaymentOccurrence.name, schema: LoanPaymentOccurrenceSchema },
      {
        name: RecurringExpenseOccurrence.name,
        schema: RecurringExpenseOccurrenceSchema,
      },
      {
        name: SubscriptionOccurrence.name,
        schema: SubscriptionOccurrenceSchema,
      },
      {
        name: PlannedIncomeOccurrence.name,
        schema: PlannedIncomeOccurrenceSchema,
      },
    ]),
  ],
  controllers: [FortnightPlansController],
  providers: [FortnightPlansService, FortnightSourcesService],
  exports: [FortnightPlansService],
})
export class FortnightPlansModule {}
